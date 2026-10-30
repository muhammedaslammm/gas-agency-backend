import express from "express";
import authenticate from "../middleware/authenticate.js";
import {
  createStockPurchase,
  getStockPurchases,
} from "../controllers/stockPurchase.controller.js";

const router = express.Router();

router.post("/stock-purchases", authenticate, createStockPurchase);
router.get("/stock-purchases", authenticate, getStockPurchases);

export default router;
