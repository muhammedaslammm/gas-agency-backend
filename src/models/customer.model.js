import mongoose from "mongoose";

const productDiscountSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const cylinderBalanceSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    emptyCylindersOwed: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Empty-cylinder balance must be a whole number.",
      },
    },
  },
  { _id: false },
);

const customerSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      default: null,
    },
    balanceAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    cylinderBalances: {
      type: [cylinderBalanceSchema],
      default: [],
    },
    productDiscounts: {
      type: [productDiscountSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
