import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(payload.userId).select(
      "name role organization isActive",
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    req.user = user;
    req.organizationId = user.organization;
    req.role = user.role;

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session",
      });
    }

    next(error);
  }
};

export default authenticate;
