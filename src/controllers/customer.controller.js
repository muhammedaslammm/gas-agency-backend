import mongoose from "mongoose";
import Customer from "../models/customer.model.js";
import Route from "../models/route.model.js";
import Product from "../models/product.model.js";
import Sale from "../models/sale.model.js";

export const createCustomer = async (req, res, next) => {
  try {
    const {
      name,
      address,
      phone,
      routeId = null,
      balanceAmount = 0,
      cylinderBalances = [],
      productDiscounts = [],
    } = req.body ?? {};

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body.",
      });
    }

    const allowedFields = [
      "name",
      "address",
      "phone",
      "routeId",
      "balanceAmount",
      "cylinderBalances",
      "productDiscounts",
    ];

    if (Object.keys(req.body).some((key) => !allowedFields.includes(key))) {
      return res.status(400).json({
        success: false,
        message: "Request contains unsupported fields.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required.",
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Customer name cannot exceed 100 characters.",
      });
    }

    if (
      address !== undefined &&
      (typeof address !== "string" || address.trim().length > 500)
    ) {
      return res.status(400).json({
        success: false,
        message: "Address must be a string of at most 500 characters.",
      });
    }

    if (
      phone !== undefined &&
      (typeof phone !== "string" || phone.trim().length > 20)
    ) {
      return res.status(400).json({
        success: false,
        message: "Phone must be a string of at most 20 characters.",
      });
    }

    if (
      typeof balanceAmount !== "number" ||
      !Number.isFinite(balanceAmount) ||
      balanceAmount < 0 ||
      Math.round(balanceAmount * 100) / 100 !== balanceAmount
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Balance balance must be a non-negative amount with up to two decimal places.",
      });
    }

    if (!Array.isArray(cylinderBalances)) {
      return res.status(400).json({
        message: "Cylinder balances must be an array.",
      });
    }

    const validatedCylinderBalances = [];
    const cylinderProductIds = new Set();

    for (const item of cylinderBalances) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        Object.keys(item).some(
          (key) => !["productId", "emptyCylindersOwed"].includes(key),
        )
      ) {
        return res.status(400).json({
          message:
            "Each cylinder balance must contain productId and emptyCylindersOwed only.",
        });
      }

      const { productId, emptyCylindersOwed } = item;

      if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({
          message: "Invalid cylinder product ID.",
        });
      }

      if (
        typeof emptyCylindersOwed !== "number" ||
        !Number.isSafeInteger(emptyCylindersOwed) ||
        emptyCylindersOwed < 0
      ) {
        return res.status(400).json({
          message:
            "Empty-cylinder balance must be a non-negative whole number.",
        });
      }

      const productIdString = productId.toString();

      if (cylinderProductIds.has(productIdString)) {
        return res.status(400).json({
          message: "Duplicate cylinder products are not allowed.",
        });
      }

      cylinderProductIds.add(productIdString);

      const product = await Product.findOne({
        _id: productId,
        organization: req.organizationId,
        stockType: "cylinder",
        deletedAt: { $exists: false },
      }).select("_id");

      if (!product) {
        return res.status(400).json({
          message: "One or more cylinder products are invalid or unavailable.",
        });
      }

      validatedCylinderBalances.push({
        product: product._id,
        emptyCylindersOwed,
      });
    }

    if (routeId !== null && !mongoose.isValidObjectId(routeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid route ID.",
      });
    }

    if (routeId !== null) {
      const route = await Route.findOne({
        _id: routeId,
        organization: req.organizationId,
        deletedAt: { $exists: false },
      });

      if (!route) {
        return res.status(400).json({
          success: false,
          message: "Selected route was not found or is inactive.",
        });
      }
    }

    if (!Array.isArray(productDiscounts)) {
      return res.status(400).json({
        success: false,
        message: "Product discounts must be an array.",
      });
    }

    const validatedDiscounts = [];
    const discountProductIds = new Set();

    for (const discount of productDiscounts) {
      if (
        !discount ||
        typeof discount !== "object" ||
        Array.isArray(discount) ||
        Object.keys(discount).some(
          (key) => !["productId", "discountAmount"].includes(key),
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Each product discount must contain only productId and discountAmount.",
        });
      }

      const { productId, discountAmount } = discount;

      if (!mongoose.isValidObjectId(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID in product discounts.",
        });
      }

      const product = await Product.findOne({
        _id: productId,
        organization: req.organizationId,
        deletedAt: { $exists: false },
      });

      if (!product) {
        return res.status(400).json({
          success: false,
          message: "A discounted product was not found or is inactive.",
        });
      }

      const normalizedProductId = String(productId);

      if (discountProductIds.has(normalizedProductId)) {
        return res.status(400).json({
          success: false,
          message: "A product can only have one discount per customer.",
        });
      }

      discountProductIds.add(normalizedProductId);

      if (
        typeof discountAmount !== "number" ||
        !Number.isFinite(discountAmount) ||
        discountAmount < 0 ||
        Math.round(discountAmount * 100) / 100 !== discountAmount
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Discount must be a non-negative amount with up to two decimal places.",
        });
      }

      if (discountAmount > product.sellingPrice) {
        return res.status(400).json({
          success: false,
          message: `Discount for ${product.name} cannot exceed its selling price.`,
        });
      }

      validatedDiscounts.push({
        product: product._id,
        discountAmount,
      });
    }

    const customer = await Customer.create({
      organization: req.organizationId,
      name: name.trim(),
      address: address?.trim(),
      phone: phone?.trim(),
      route: routeId,
      balanceAmount,
      cylinderBalances: validatedCylinderBalances,
      productDiscounts: validatedDiscounts,
    });

    return res.status(201).json({
      success: true,
      message: "Customer created successfully.",
      customer,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find({
      organization: req.organizationId,
      deletedAt: { $exists: false },
    })
      .select("-organization -updatedAt -__v")
      .populate("route", "name")
      .populate("cylinderBalances.product", "name")
      .populate("productDiscounts.product", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID.",
      });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    })
      .select("-organization -updatedAt -__v")
      .populate("route", "name")
      .populate("cylinderBalances.product", "name")
      .populate("productDiscounts.product", "name")
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    return res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    return next(error);
  }
};

export const getCustomersLookup = async (req, res, next) => {
  try {
    const customers = await Customer.find({
      organization: req.organizationId,
      deletedAt: { $exists: false },
    })
      .select("_id name")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerByIdLookup = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID.",
      });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    })
      .select("_id name route balanceAmount cylinderBalances productDiscounts")
      .populate("route", "name")
      .populate("cylinderBalances.product", "name stockType")
      .populate("productDiscounts.product", "name sellingPrice stockType")
      .lean();

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    return res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID.",
      });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body.",
      });
    }

    const allowedFields = [
      "name",
      "address",
      "phone",
      "routeId",
      "productDiscounts",
    ];

    const fields = Object.keys(req.body);

    if (
      fields.length === 0 ||
      fields.some((key) => !allowedFields.includes(key))
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide valid customer fields to update.",
      });
    }

    if (Object.hasOwn(req.body, "name")) {
      const { name } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Customer name is required and cannot exceed 100 characters.",
        });
      }

      customer.name = name.trim();
    }

    if (Object.hasOwn(req.body, "address")) {
      const { address } = req.body;

      if (
        address !== null &&
        (typeof address !== "string" || address.trim().length > 500)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Address must be a string of at most 500 characters, or null.",
        });
      }

      customer.address = address === null ? undefined : address.trim();
    }

    if (Object.hasOwn(req.body, "phone")) {
      const { phone } = req.body;

      if (
        phone !== null &&
        (typeof phone !== "string" || phone.trim().length > 20)
      ) {
        return res.status(400).json({
          success: false,
          message: "Phone must be a string of at most 20 characters, or null.",
        });
      }

      customer.phone = phone === null ? undefined : phone.trim();
    }

    if (Object.hasOwn(req.body, "routeId")) {
      const { routeId } = req.body;

      if (routeId !== null && !mongoose.isValidObjectId(routeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid route ID.",
        });
      }

      if (routeId !== null) {
        const route = await Route.findOne({
          _id: routeId,
          organization: req.organizationId,
          deletedAt: { $exists: false },
        });

        if (!route) {
          return res.status(400).json({
            success: false,
            message: "Selected route was not found or is inactive.",
          });
        }
      }

      customer.route = routeId;
    }

    if (Object.hasOwn(req.body, "productDiscounts")) {
      const { productDiscounts } = req.body;

      if (!Array.isArray(productDiscounts)) {
        return res.status(400).json({
          success: false,
          message: "Product discounts must be an array.",
        });
      }

      const validatedDiscounts = [];
      const discountProductIds = new Set();

      for (const discount of productDiscounts) {
        if (
          !discount ||
          typeof discount !== "object" ||
          Array.isArray(discount) ||
          Object.keys(discount).some(
            (key) => !["productId", "discountAmount"].includes(key),
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Each product discount must contain only productId and discountAmount.",
          });
        }

        const { productId, discountAmount } = discount;

        if (!mongoose.isValidObjectId(productId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid product ID in product discounts.",
          });
        }

        const product = await Product.findOne({
          _id: productId,
          organization: req.organizationId,
          deletedAt: { $exists: false },
        });

        if (!product) {
          return res.status(400).json({
            success: false,
            message: "A discounted product was not found or is inactive.",
          });
        }

        const normalizedProductId = String(productId);

        if (discountProductIds.has(normalizedProductId)) {
          return res.status(400).json({
            success: false,
            message: "A product can only have one discount per customer.",
          });
        }

        discountProductIds.add(normalizedProductId);

        if (
          typeof discountAmount !== "number" ||
          !Number.isFinite(discountAmount) ||
          discountAmount < 0 ||
          Math.round(discountAmount * 100) / 100 !== discountAmount
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Discount must be a non-negative amount with up to two decimal places.",
          });
        }

        if (discountAmount > product.sellingPrice) {
          return res.status(400).json({
            success: false,
            message: `Discount for ${product.name} cannot exceed its selling price.`,
          });
        }

        validatedDiscounts.push({
          product: product._id,
          discountAmount,
        });
      }

      customer.productDiscounts = validatedDiscounts;
    }

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully.",
      customer,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID.",
      });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    customer.deletedAt = new Date();
    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
