import Product from "../models/product.model.js";

export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      stockType,
      sellingPrice,
      quantity,
      filledQuantity,
      emptyQuantity,
    } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Product name cannot exceed 100 characters",
      });
    }

    if (!["cylinder", "other"].includes(stockType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product stock type",
      });
    }

    if (
      typeof sellingPrice !== "number" ||
      !Number.isFinite(sellingPrice) ||
      sellingPrice < 0 ||
      Math.round(sellingPrice * 100) !== sellingPrice * 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Selling price must be non-negative with at most two decimal places",
      });
    }

    const isValidQuantity = (value) =>
      value === undefined || (Number.isSafeInteger(value) && value >= 0);

    let stockFields;

    if (stockType === "cylinder") {
      if (
        quantity !== undefined ||
        !isValidQuantity(filledQuantity) ||
        !isValidQuantity(emptyQuantity)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Provide valid filled and empty quantities for a cylinder product",
        });
      }

      stockFields = {
        filledQuantity: filledQuantity ?? 0,
        emptyQuantity: emptyQuantity ?? 0,
      };
    } else {
      if (
        filledQuantity !== undefined ||
        emptyQuantity !== undefined ||
        !isValidQuantity(quantity)
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide a valid quantity for a non-cylinder product",
        });
      }

      stockFields = { quantity: quantity ?? 0 };
    }

    const existingProduct = await Product.findOne({
      organization: req.organizationId,
      name: { $regex: trimmedName, $options: "i" },
      deletedAt: { $exists: false },
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "A product with this name already exists",
      });
    }

    const product = await Product.create({
      organization: req.organizationId,
      name: trimmedName,
      stockType,
      sellingPrice,
      ...stockFields,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    return next(error);
  }
};

export const getProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      organization: req.organizationId,
      deletedAt: { $exists: false },
    })
      .select(
        "name stockType sellingPrice quantity filledQuantity emptyQuantity createdAt",
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSelectableProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      organization: req.organizationId,
      deletedAt: { $exists: false },
    })
      .select("_id name stockType")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({
      _id: productId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const allowedFields = ["name", "sellingPrice"];

    if (Object.keys(req.body).some((key) => !allowedFields.includes(key))) {
      return res.status(400).json({
        success: false,
        message: "Request contains unsupported fields.",
      });
    }

    const { name, sellingPrice } = req.body ?? {};

    if (name === undefined && sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide a name or selling price to update",
      });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Product name cannot be empty",
        });
      }

      const trimmedName = name.trim();

      if (trimmedName.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Product name cannot exceed 100 characters",
        });
      }

      const existingProduct = await Product.findOne({
        _id: { $ne: product._id },
        organization: req.organizationId,
        name: { $regex: trimmedName, $options: "i" },
        deletedAt: { $exists: false },
      });

      if (existingProduct) {
        return res.status(409).json({
          success: false,
          message: "A product with this name already exists",
        });
      }

      product.name = trimmedName;
    }

    if (sellingPrice !== undefined) {
      if (
        typeof sellingPrice !== "number" ||
        !Number.isFinite(sellingPrice) ||
        sellingPrice < 0 ||
        Math.round(sellingPrice * 100) !== sellingPrice * 100
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Selling price must be non-negative with at most two decimal places",
        });
      }

      product.sellingPrice = sellingPrice;
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({
      _id: productId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.deletedAt = new Date();
    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};
