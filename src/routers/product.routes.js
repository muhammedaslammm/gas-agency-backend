import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProducts,
  getSelectableProducts,
  updateProduct,
} from "../controllers/product.controller.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

router.post("/products", authenticate, createProduct);
router.get("/products", authenticate, getProducts);
router.get("/products/select", authenticate, getSelectableProducts);
router.patch("/products/:productId", authenticate, updateProduct);
router.delete("/products/:productId", authenticate, deleteProduct);

export default router;
