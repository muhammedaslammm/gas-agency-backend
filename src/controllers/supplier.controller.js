import mongoose from "mongoose";
import Supplier from "../models/supplier.model.js";

export const createSupplier = async (req, res, next) => {
  try {
    const { name, contactPerson, phone, address } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Supplier name is required",
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Supplier name cannot exceed 100 characters",
      });
    }

    const existingSupplier = await Supplier.findOne({
      organization: req.organizationId,
      name: { $regex: name, $options: "i" },
      deletedAt: { $exists: false },
    });

    if (existingSupplier)
      return res.status(409).json({
        success: false,
        message: "A supplier with this name already exists",
      });

    const optionalFields = [
      ["contactPerson", contactPerson, 100],
      ["phone", phone, 20],
      ["address", address, 500],
    ];

    for (const [field, value, maxLength] of optionalFields) {
      if (
        value !== undefined &&
        (typeof value !== "string" || value.length > maxLength)
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field}`,
        });
      }
    }

    const supplier = await Supplier.create({
      organization: req.organizationId,
      name: name.trim(),
      ...(contactPerson !== undefined && {
        contactPerson: contactPerson.trim(),
      }),
      ...(phone !== undefined && { phone: phone.trim() }),
      ...(address !== undefined && { address: address.trim() }),
    });

    return res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      supplier,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({
      organization: req.organizationId,
      deletedAt: { $exists: false },
    })
      .select("name contactPerson phone address createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: suppliers.length,
      suppliers,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSuppliersforPurchase = async (req, res, next) => {
  try {
    const suppliers = await Supplier.find({
      organization: req.organizationId,
      deletedAt: { $exists: false },
    })
      .select("name _id")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: suppliers.length,
      suppliers,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const { name, contactPerson, phone, address } = req.body ?? {};

    if (!mongoose.isValidObjectId(supplierId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier ID",
      });
    }

    const supplier = await Supplier.findOne({
      _id: supplierId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    const allowedFields = ["name", "contactPerson", "phone", "address"];

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).some((field) => !allowedFields.includes(field))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid fields",
      });
    }

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim() || name.trim().length > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Supplier name must be between 1 and 100 characters",
      });
    }

    const optionalFields = [
      ["contactPerson", contactPerson, 100],
      ["phone", phone, 10],
      ["address", address, 500],
    ];

    for (const [field, value, maxLength] of optionalFields) {
      if (
        value !== undefined &&
        (typeof value !== "string" || value.length > maxLength)
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field}`,
        });
      }
    }

    let duplicateSupplier = await Supplier.findOne({
      _id: { $ne: supplier._id },
      organization: req.organizationId,
      name: { $regex: name, $options: "i" },
      deletedAt: { $exists: false },
    });

    if (duplicateSupplier)
      return res.status(409).json({
        success: false,
        message: "Supplier with this name already exists",
      });

    if (name !== undefined) supplier.name = name.trim();
    if (contactPerson !== undefined) {
      supplier.contactPerson = contactPerson.trim();
    }
    if (phone !== undefined) supplier.phone = phone.trim();
    if (address !== undefined) supplier.address = address.trim();

    await supplier.save();

    return res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      supplier,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteSupplier = async (req, res, next) => {
  try {
    const { supplierId } = req.params;

    if (!mongoose.isValidObjectId(supplierId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier ID",
      });
    }

    const supplier = await Supplier.findOne({
      _id: supplierId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    supplier.deletedAt = new Date();
    await supplier.save();

    return res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};
