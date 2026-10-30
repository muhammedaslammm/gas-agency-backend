import mongoose from "mongoose";
import Sale from "../models/sale.model.js";
import Product from "../models/product.model.js";
import Customer from "../models/customer.model.js";
import Payment from "../models/payment.model.js";

const roundMoney = (amount) => Math.round(amount * 100) / 100;

export const createSale = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const {
      customerId,
      items = [],
      emptyCylinderReturns = [],
      paymentReceived = 0,
      paymentMethod,
      saleDate,
    } = req.body;

    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ message: "Invalid customer ID." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "A sale must contain at least one item.",
      });
    }

    if (!Array.isArray(emptyCylinderReturns)) {
      return res.status(400).json({
        message: "Empty-cylinder returns must be an array.",
      });
    }

    if (
      typeof paymentReceived !== "number" ||
      !Number.isFinite(paymentReceived) ||
      paymentReceived < 0 ||
      Math.round(paymentReceived * 100) / 100 !== paymentReceived
    ) {
      return res.status(400).json({
        message:
          "Payment received must be a non-negative amount with at most two decimal places.",
      });
    }

    if (
      paymentReceived > 0 &&
      !["cash", "bank-transfer", "upi"].includes(paymentMethod)
    ) {
      return res.status(400).json({
        message: "A valid payment method is required when payment is received.",
      });
    }

    if (paymentReceived === 0 && paymentMethod !== undefined) {
      return res.status(400).json({
        message:
          "Payment method should only be provided when payment is received.",
      });
    }

    let parsedSaleDate;

    if (saleDate !== undefined) {
      parsedSaleDate = new Date(saleDate);

      if (
        typeof saleDate !== "string" ||
        Number.isNaN(parsedSaleDate.getTime())
      ) {
        return res.status(400).json({ message: "Invalid sale date." });
      }
    } else {
      parsedSaleDate = new Date();
    }

    const saleProductIds = new Set();

    for (const item of items) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        Object.keys(item).some(
          (key) => !["productId", "quantity"].includes(key),
        ) ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({
          message:
            "Each sale item must contain a valid productId and a positive whole-number quantity.",
        });
      }

      const productId = item.productId.toString();

      if (saleProductIds.has(productId)) {
        return res.status(400).json({
          message: "Duplicate products are not allowed in a sale.",
        });
      }

      saleProductIds.add(productId);
    }

    const returnProductIds = new Set();

    for (const item of emptyCylinderReturns) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        Object.keys(item).some(
          (key) => !["productId", "quantity"].includes(key),
        ) ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return res.status(400).json({
          message:
            "Each empty-cylinder return must contain a valid productId and a positive whole-number quantity.",
        });
      }

      const productId = item.productId.toString();

      if (returnProductIds.has(productId)) {
        return res.status(400).json({
          message:
            "Duplicate products are not allowed in empty-cylinder returns.",
        });
      }

      returnProductIds.add(productId);
    }

    let createdSale;
    let outstandingBalance;

    await session.withTransaction(async () => {
      const customer = await Customer.findOne({
        _id: customerId,
        organization: req.organizationId,
        deletedAt: { $exists: false },
      }).session(session);

      if (!customer) {
        const error = new Error("Customer not found.");
        error.statusCode = 404;
        throw error;
      }

      const saleItems = [];
      let totalAmount = 0;

      for (const item of items) {
        const product = await Product.findOne({
          _id: item.productId,
          organization: req.organizationId,
          deletedAt: { $exists: false },
        }).session(session);

        if (!product) {
          const error = new Error(
            "One or more products are invalid or unavailable.",
          );
          error.statusCode = 400;
          throw error;
        }

        const discountEntry = customer.productDiscounts.find(
          (entry) => entry.product.toString() === product._id.toString(),
        );

        const discountPerUnit = discountEntry
          ? discountEntry.discountAmount
          : 0;

        if (discountPerUnit > product.sellingPrice) {
          const error = new Error(
            `The configured discount for "${product.name}" exceeds its current selling price. Update the customer discount before making this sale.`,
          );
          error.statusCode = 409;
          throw error;
        }

        const unitPrice = roundMoney(product.sellingPrice - discountPerUnit);

        const lineTotal = roundMoney(unitPrice * item.quantity);

        saleItems.push({
          product: product._id,
          productName: product.name,
          stockType: product.stockType,
          quantity: item.quantity,
          standardUnitPrice: product.sellingPrice,
          discountPerUnit,
          unitPrice,
          lineTotal,
        });

        totalAmount = roundMoney(totalAmount + lineTotal);
      }

      const validatedReturns = [];

      for (const item of emptyCylinderReturns) {
        const product = await Product.findOne({
          _id: item.productId,
          organization: req.organizationId,
          stockType: "cylinder",
          deletedAt: { $exists: false },
        }).session(session);

        if (!product) {
          const error = new Error(
            "Each returned product must be an active cylinder product in this organization.",
          );
          error.statusCode = 400;
          throw error;
        }

        const balanceEntry = customer.cylinderBalances.find(
          (entry) => entry.product.toString() === product._id.toString(),
        );

        const currentObligation = balanceEntry?.emptyCylindersOwed ?? 0;

        if (item.quantity > currentObligation) {
          const error = new Error(
            `Cannot accept ${item.quantity} empty "${product.name}" cylinders. The customer's outstanding quantity is ${currentObligation}.`,
          );
          error.statusCode = 409;
          throw error;
        }

        validatedReturns.push({
          product: product._id,
          productName: product.name,
          quantity: item.quantity,
        });
      }

      const balanceBeforePayment = roundMoney(
        customer.balanceAmount + totalAmount,
      );

      if (paymentReceived > balanceBeforePayment) {
        const error = new Error(
          "Payment cannot exceed the customer's outstanding balance.",
        );
        error.statusCode = 400;
        throw error;
      }

      outstandingBalance = roundMoney(balanceBeforePayment - paymentReceived);

      // Deduct filled cylinders or other products from stock.
      for (const item of saleItems) {
        const stockField =
          item.stockType === "cylinder" ? "filledQuantity" : "quantity";

        const result = await Product.updateOne(
          {
            _id: item.product,
            organization: req.organizationId,
            stockType: item.stockType,
            deletedAt: { $exists: false },
            [stockField]: { $gte: item.quantity },
          },
          {
            $inc: { [stockField]: -item.quantity },
          },
          { session },
        );

        if (result.modifiedCount !== 1) {
          const error = new Error(
            `Insufficient stock for "${item.productName}".`,
          );
          error.statusCode = 409;
          throw error;
        }
      }

      // Returned cylinders are independent of the sale items.
      for (const item of validatedReturns) {
        const result = await Product.updateOne(
          {
            _id: item.product,
            organization: req.organizationId,
            stockType: "cylinder",
            deletedAt: { $exists: false },
          },
          {
            $inc: { emptyQuantity: item.quantity },
          },
          { session },
        );

        if (result.modifiedCount !== 1) {
          const error = new Error(
            `Could not update empty-cylinder stock for "${item.productName}".`,
          );
          error.statusCode = 409;
          throw error;
        }
      }

      for (const item of saleItems) {
        if (item.stockType !== "cylinder") continue;

        let balanceEntry = customer.cylinderBalances.find(
          (entry) => entry.product.toString() === item.product.toString(),
        );

        if (!balanceEntry) {
          customer.cylinderBalances.push({
            product: item.product,
            emptyCylindersOwed: 0,
          });

          balanceEntry =
            customer.cylinderBalances[customer.cylinderBalances.length - 1];
        }

        balanceEntry.emptyCylindersOwed += item.quantity;
      }

      for (const item of validatedReturns) {
        let balanceEntry = customer.cylinderBalances.find(
          (entry) => entry.product.toString() === item.product.toString(),
        );

        // The return validation above guarantees this entry exists
        // and that the return does not exceed its previous balance.
        balanceEntry.emptyCylindersOwed -= item.quantity;
      }

      customer.balanceAmount = outstandingBalance;

      await customer.save({ session });

      const sale = new Sale({
        organization: req.organizationId,
        customer: customer._id,
        customerName: customer.name,
        items: saleItems,
        emptyCylinderReturns: validatedReturns,
        totalAmount,
        saleDate: parsedSaleDate,
        createdBy: req.user._id,
      });

      await sale.save({ session });

      if (paymentReceived > 0) {
        const payment = new Payment({
          organization: req.organizationId,
          customer: customer._id,
          customerName: customer.name,
          sale: sale._id,
          amount: paymentReceived,
          method: paymentMethod,
          paymentDate: parsedSaleDate,
          recordedBy: req.user._id,
        });

        await payment.save({ session });
      }

      createdSale = sale;

      outstandingBalance = roundMoney(balanceBeforePayment - paymentReceived);
    });

    return res.status(201).json({
      message: "Sale recorded successfully.",
      sale: createdSale,
      outstandingBalance,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    return next(error);
  } finally {
    await session.endSession();
  }
};

export const getSales = async (req, res, next) => {
  try {
    const sales = await Sale.find({
      organization: req.organizationId,
    })
      .sort({ saleDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ sales });
  } catch (error) {
    return next(error);
  }
};
