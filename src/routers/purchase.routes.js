import express from "express";
import authenticate from "../middleware/authenticate.js";
import {
  createPurchase,
  getPurchases,
} from "../controllers/purchase.controller.js";

const router = express.Router();

router.post("/purchases", authenticate, createPurchase);
router.get("/purchases", authenticate, getPurchases);

export default router;
