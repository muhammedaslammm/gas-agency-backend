import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
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

    contactPerson: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },

    address: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

const Supplier = mongoose.model("Supplier", supplierSchema);

export default Supplier;
