import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProducts,
  getProductsforCustomers,
  updateProduct,
} from "../controllers/product.controller.js";
import authenticate from "../middleware/authenticate.js";

const router = Router();

router.post("/products", authenticate, createProduct);
router.get("/products", authenticate, getProducts);
router.get("/products/customers", authenticate, getProductsforCustomers);
router.patch("/products/:productId", authenticate, updateProduct);
router.delete("/products/:productId", authenticate, deleteProduct);

export default router;
