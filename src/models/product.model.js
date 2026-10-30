import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
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

    stockType: {
      type: String,
      enum: ["cylinder", "other"],
      required: true,
      immutable: true,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // For non-cylinder products.
    quantity: {
      type: Number,
      min: 0,
    },

    // For cylinder products.
    filledQuantity: {
      type: Number,
      min: 0,
    },

    emptyQuantity: {
      type: Number,
      min: 0,
    },

    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

const Product = mongoose.model("Product", productSchema);

export default Product;
