import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    stockType: {
      type: String,
      enum: ["cylinder", "other"],
      required: true,
      default: "cylinder",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Purchase quantity must be a whole number.",
      },
    },
    totalGstPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) =>
          Number.isFinite(value) && Math.round(value * 100) === value * 100,
        message: "GST price must have up to two decimal places.",
      },
    },
  },
  { _id: false },
);

const purchaseSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      immutable: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [purchaseItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "A purchase must contain at least one item.",
      },
    },
    totalBillPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    emr: {
      type: Boolean,
      default: false,
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Keep the existing MongoDB collection so existing purchase records remain accessible.
const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;
