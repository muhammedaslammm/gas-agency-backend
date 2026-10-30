import express from "express";
import { createSale, getSales } from "../controllers/sale.controller.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

router.use(authenticate);

router.post("/sales", createSale);
router.get("/sales", getSales);

export default router;
