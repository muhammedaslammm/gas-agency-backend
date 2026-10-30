import mongoose from "mongoose";
import Route from "../models/route.model.js";

export const createRoute = async (req, res, next) => {
  try {
    const { name } = req.body ?? {};

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body.",
      });
    }

    if (Object.keys(req.body).some((key) => key !== "name")) {
      return res.status(400).json({
        success: false,
        message: "Request contains unsupported fields.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Route name is required.",
      });
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Route name cannot exceed 100 characters.",
      });
    }

    const existingRoute = await Route.findOne({
      organization: req.organizationId,
      name: { $regex: trimmedName, $options: "i" },
      deletedAt: { $exists: false },
    });

    if (existingRoute) {
      return res.status(409).json({
        success: false,
        message: "A route with this name already exists.",
      });
    }

    const route = await Route.create({
      organization: req.organizationId,
      name: trimmedName,
    });

    return res.status(201).json({
      success: true,
      message: "Route created successfully.",
      route,
    });
  } catch (error) {
    next(error);
  }
};

export const getRoutes = async (req, res, next) => {
  try {
    const routes = await Route.find({
      organization: req.organizationId,
      deletedAt: { $exists: false },
    })
      .select("-organization -updatedAt -__v")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: routes.length,
      routes,
    });
  } catch (error) {
    next(error);
  }
};

export const updateRoute = async (req, res, next) => {
  try {
    const { routeId } = req.params;

    if (!mongoose.isValidObjectId(routeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid route ID.",
      });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body.",
      });
    }

    if (
      Object.keys(req.body).length !== 1 ||
      !Object.hasOwn(req.body, "name")
    ) {
      return res.status(400).json({
        success: false,
        message: "Only the route name can be updated.",
      });
    }

    const { name } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Route name is required.",
      });
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Route name cannot exceed 100 characters.",
      });
    }

    const route = await Route.findOne({
      _id: routeId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found.",
      });
    }

    const existingRoute = await Route.findOne({
      _id: { $ne: route._id },
      organization: req.organizationId,
      name: { $regex: trimmedName, $options: "i" },
      deletedAt: { $exists: false },
    });

    if (existingRoute) {
      return res.status(409).json({
        success: false,
        message: "A route with this name already exists.",
      });
    }

    route.name = trimmedName;
    await route.save();

    return res.status(200).json({
      success: true,
      message: "Route updated successfully.",
      route,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRoute = async (req, res, next) => {
  try {
    const { routeId } = req.params;

    if (!mongoose.isValidObjectId(routeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid route ID.",
      });
    }

    const route = await Route.findOne({
      _id: routeId,
      organization: req.organizationId,
      deletedAt: { $exists: false },
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found.",
      });
    }

    // Once the Customer model is registered, prevent deleting
    // a route that still has active customers assigned to it.
    const Customer = mongoose.models.Customer;

    if (Customer) {
      const assignedCustomer = await Customer.exists({
        organization: req.organizationId,
        route: route._id,
        deletedAt: { $exists: false },
      });

      if (assignedCustomer) {
        return res.status(409).json({
          success: false,
          message:
            "This route has active customers assigned to it. Reassign those customers before deleting the route.",
        });
      }
    }

    route.deletedAt = new Date();
    await route.save();

    return res.status(200).json({
      success: true,
      message: "Route deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
