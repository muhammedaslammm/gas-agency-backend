import mongoose from "mongoose";
import StockPurchase from "../models/stockPurchase.model.js";
import Supplier from "../models/supplier.model.js";
import Product from "../models/product.model.js";

export const createStockPurchase = async (req, res, next) => {
  try {
    const { supplierId, items, purchaseDate } = req.body ?? {};

    const fail = (message, statusCode = 400) => {
      const error = new Error(message);
      error.statusCode = statusCode;
      throw error;
    };

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      fail("Invalid request body.");
    }

    const allowedFields = ["supplierId", "items", "purchaseDate"];

    if (Object.keys(req.body).some((key) => !allowedFields.includes(key))) {
      fail("Request contains unsupported fields.");
    }

    if (!mongoose.isValidObjectId(supplierId)) {
      fail("A valid supplier is required.");
    }

    const supplier = await Supplier.findOne({
      _id: supplierId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    });

    if (!supplier) {
      fail("Supplier not found.", 404);
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

    const parsedItems = [];
    const productIds = new Set();
    let totalCost = 0;

    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        fail("Each purchase item must be an object.");
      }

      const allowedItemFields = [
        "productId",
        "quantity",
        "unitCost",
        "emptyQuantityReturned",
      ];

      if (Object.keys(item).some((key) => !allowedItemFields.includes(key))) {
        fail("A purchase item contains unsupported fields.");
      }

      const { productId, quantity, unitCost, emptyQuantityReturned = 0 } = item;

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
        typeof unitCost !== "number" ||
        !Number.isFinite(unitCost) ||
        unitCost < 0 ||
        Math.round(unitCost * 100) !== unitCost * 100
      ) {
        fail("Unit cost must be a valid amount with up to two decimal places.");
      }

      if (
        !Number.isSafeInteger(emptyQuantityReturned) ||
        emptyQuantityReturned < 0
      ) {
        fail(
          "Returned empty-cylinder quantity must be a non-negative whole number.",
        );
      }

      const lineTotal = Math.round(quantity * unitCost * 100) / 100;

      if (!Number.isFinite(lineTotal)) {
        fail("Purchase item total is too large.");
      }

      totalCost = Math.round((totalCost + lineTotal) * 100) / 100;

      if (!Number.isFinite(totalCost)) {
        fail("Purchase total is too large.");
      }

      parsedItems.push({
        productId: normalizedProductId,
        quantity,
        unitCost,
        emptyQuantityReturned,
        lineTotal,
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

          if (
            product.stockType !== "cylinder" &&
            item.emptyQuantityReturned > 0
          ) {
            fail(
              `Empty cylinders can only be returned against cylinder products: ${product.name}.`,
            );
          }

          const stockUpdate =
            product.stockType === "cylinder"
              ? {
                  $inc: {
                    filledQuantity: item.quantity,
                    emptyQuantity: -item.emptyQuantityReturned,
                  },
                }
              : {
                  $inc: {
                    quantity: item.quantity,
                  },
                };

          const stockFilter = {
            _id: product._id,
            organization: req.organizationId,
            deletedAt: { $exists: false },
          };

          if (
            product.stockType === "cylinder" &&
            item.emptyQuantityReturned > 0
          ) {
            stockFilter.emptyQuantity = {
              $gte: item.emptyQuantityReturned,
            };
          }

          const updatedProduct = await Product.findOneAndUpdate(
            stockFilter,
            stockUpdate,
            {
              new: true,
              runValidators: true,
              session,
            },
          );

          if (!updatedProduct) {
            fail(
              `Stock changed or there are not enough empty cylinders for ${product.name}. Please check the stock and try again.`,
              409,
            );
          }

          purchaseItems.push({
            product: product._id,
            productName: product.name,
            stockType: product.stockType,
            quantity: item.quantity,
            unitCost: item.unitCost,
            lineTotal: item.lineTotal,
            emptyQuantityReturned: item.emptyQuantityReturned,
          });
        }

        const [purchase] = await StockPurchase.create(
          [
            {
              organization: req.organizationId,
              supplier: supplier._id,
              supplierName: supplier.name,
              items: purchaseItems,
              totalCost,
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
      message: "Stock purchase recorded successfully.",
      purchase: createdPurchase,
    });
  } catch (error) {
    next(error);
  }
};

export const getStockPurchases = async (req, res, next) => {
  try {
    const purchases = await StockPurchase.find({
      organization: req.organizationId,
    })
      .sort({ purchaseDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: purchases.length,
      purchases,
    });
  } catch (error) {
    next(error);
  }
};
