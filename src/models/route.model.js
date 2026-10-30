import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
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
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

const Route = mongoose.model("Route", routeSchema);

export default Route;
