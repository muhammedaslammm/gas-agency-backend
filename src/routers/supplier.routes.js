import { Router } from "express";
import {
  createSupplier,
  getSuppliers,
  updateSupplier,
  deleteSupplier,
  getSuppliersforPurchase,
} from "../controllers/supplier.controller.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

router.post("/suppliers", authenticate, createSupplier);
router.get("/suppliers", authenticate, getSuppliers);
router.get("/suppliers/purchase", authenticate, getSuppliersforPurchase);
router.patch("/suppliers/:supplierId", authenticate, updateSupplier);
router.delete("/suppliers/:supplierId", authenticate, deleteSupplier);

export default router;
