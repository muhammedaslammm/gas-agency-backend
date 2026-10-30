import express from "express";
import authenticate from "../middleware/authenticate.js";
import {
  createCustomer,
  getCustomersLookup,
  updateCustomer,
  deleteCustomer,
  getCustomerByIdLookup,
  getCustomers,
  getCustomerById,
} from "../controllers/customer.controller.js";

const router = express.Router();

router.post("/customers", authenticate, createCustomer);
router.get("/customers", authenticate, getCustomers);
router.get("/customers/lookup", authenticate, getCustomersLookup);
router.get(
  "/customers/:customerId/lookup",
  authenticate,
  getCustomerByIdLookup,
);
router.get("/customers/:customerId", authenticate, getCustomerById);
router.patch("/customers/:customerId", authenticate, updateCustomer);
router.delete("/customers/:customerId", authenticate, deleteCustomer);

export default router;
