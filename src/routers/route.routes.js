import express from "express";
import authenticate from "../middleware/authenticate.js";
import {
  createRoute,
  getRoutes,
  updateRoute,
  deleteRoute,
} from "../controllers/route.controller.js";

const router = express.Router();

router.post("/routes", authenticate, createRoute);
router.get("/routes", authenticate, getRoutes);
router.patch("/routes/:routeId", authenticate, updateRoute);
router.delete("/routes/:routeId", authenticate, deleteRoute);

export default router;
