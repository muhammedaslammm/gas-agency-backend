import mongoose from "mongoose";
import Purchase from "../models/purchase.model.js";
import Supplier from "../models/supplier.model.js";
import Product from "../models/product.model.js";

export const createPurchase = async (req, res, next) => {
  try {
    const {
      invoiceNumber,
      supplierId,
      items,
      purchaseDate,
      emr = false,
    } = req.body ?? {};

    const fail = (message, statusCode = 400) => {
      const error = new Error(message);
      error.statusCode = statusCode;
      throw error;
    };

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      fail("Invalid request body.");
    }

    const allowedFields = [
      "invoiceNumber",
      "supplierId",
      "items",
      "purchaseDate",
      "emr",
    ];

    if (Object.keys(req.body).some((key) => !allowedFields.includes(key))) {
      fail("Request contains unsupported fields.");
    }

    if (
      typeof invoiceNumber !== "string" ||
      !invoiceNumber.trim() ||
      invoiceNumber.trim().length > 100
    ) {
      fail("A valid invoice number is required (maximum 100 characters).");
    }

    if (!mongoose.isValidObjectId(supplierId)) {
      fail("A valid supplier is required.");
    }

    if (typeof emr !== "boolean") {
      fail("Invalid EMR value");
    }

    if (!Array.isArray(items) || items.length === 0) {
      fail("Add at least one purchase item.");
    }

    if (purchaseDate !== undefined) {
      if (
        typeof purchaseDate !== "string" ||
        Number.isNaN(Date.parse(purchaseDate))
      ) {
        fail("A valid purchase date is required.");
      }
    }

    const supplier = await Supplier.findOne({
      _id: supplierId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    }).lean();

    if (!supplier) {
      fail("Supplier not found.", 404);
    }

    const parsedItems = [];
    const productIds = new Set();
    let totalBillPrice = 0;

    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        fail("Invalid purchase item");
      }

      const allowedItemFields = ["productId", "quantity", "totalGstPrice"];

      if (Object.keys(item).some((key) => !allowedItemFields.includes(key))) {
        fail("A purchase item contains unsupported fields.");
      }

      const { productId, quantity, totalGstPrice } = item;

      if (!mongoose.isValidObjectId(productId)) {
        fail("Each item must have a valid product.");
      }

      const normalizedProductId = String(productId);

      if (productIds.has(normalizedProductId)) {
        fail(
          "A product can only appear once per purchase. Combine its quantities into one item.",
        );
      }

      productIds.add(normalizedProductId);

      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        fail("Item quantity must be a positive whole number.");
      }

      if (
        typeof totalGstPrice !== "number" ||
        !Number.isFinite(totalGstPrice) ||
        totalGstPrice < 0 ||
        Math.round(totalGstPrice * 100) !== totalGstPrice * 100
      ) {
        fail(
          "Product GST price must be a non-negative amount with up to two decimal places.",
        );
      }

      totalBillPrice = Math.round((totalBillPrice + totalGstPrice) * 100) / 100;

      if (!Number.isFinite(totalBillPrice)) {
        fail("Purchase total is too large.");
      }

      parsedItems.push({
        productId: normalizedProductId,
        quantity,
        totalGstPrice,
      });
    }

    const session = await mongoose.startSession();
    let createdPurchase;

    try {
      await session.withTransaction(async () => {
        const purchaseItems = [];

        for (const item of parsedItems) {
          const product = await Product.findOne({
            _id: item.productId,
            organization: req.organizationId,
            deletedAt: { $exists: false },
          }).session(session);

          if (!product) {
            fail("A selected product was not found or is inactive.", 404);
          }

          let stockUpdate;

          if (product.stockType === "cylinder") {
            if (!Number.isSafeInteger(product.filledQuantity + item.quantity)) {
              fail(
                `Filled stock would exceed the safe limit for ${product.name}.`,
              );
            }

            if (
              !emr &&
              !Number.isSafeInteger(product.emptyQuantity - item.quantity)
            ) {
              fail(
                `Empty stock would exceed the safe limit for ${product.name}.`,
              );
            }

            stockUpdate = {
              $inc: {
                filledQuantity: item.quantity,
                ...(emr ? {} : { emptyQuantity: -item.quantity }),
              },
            };
          } else {
            if (!Number.isSafeInteger(product.quantity + item.quantity)) {
              fail(`Stock would exceed the safe limit for ${product.name}.`);
            }

            stockUpdate = {
              $inc: {
                quantity: item.quantity,
              },
            };
          }

          const updatedProduct = await Product.findOneAndUpdate(
            {
              _id: product._id,
              organization: req.organizationId,
              deletedAt: { $exists: false },
            },
            stockUpdate,
            {
              new: true,
              runValidators: true,
              session,
            },
          );

          if (!updatedProduct) {
            fail(
              `Stock could not be updated for ${product.name}. Please try again.`,
              409,
            );
          }

          purchaseItems.push({
            product: product._id,
            productName: product.name,
            stockType: product.stockType,
            quantity: item.quantity,
            totalGstPrice: item.totalGstPrice,
          });
        }

        const [purchase] = await Purchase.create(
          [
            {
              organization: req.organizationId,
              invoiceNumber: invoiceNumber.trim(),
              supplier: supplier._id,
              supplierName: supplier.name,
              items: purchaseItems,
              totalBillPrice,
              emr,
              purchaseDate:
                purchaseDate === undefined
                  ? new Date()
                  : new Date(purchaseDate),
              createdBy: req.user._id,
            },
          ],
          { session },
        );

        createdPurchase = purchase;
      });
    } finally {
      await session.endSession();
    }

    return res.status(201).json({
      success: true,
      message: "Purchase recorded successfully.",
      purchase: createdPurchase,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPurchases = async (req, res, next) => {
  try {
    const purchases = await Purchase.find({
      organization: req.organizationId,
    })
      .select("-organization -supplier -updatedAt -__v")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: purchases.length,
      purchases,
    });
  } catch (error) {
    return next(error);
  }
};
