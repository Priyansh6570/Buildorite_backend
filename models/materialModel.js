import mongoose from "mongoose";

const priceSchema = new mongoose.Schema({
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: [0, "Quantity cannot be negative"],
  },
  unit: {
    type: String,
    required: [true, "Unit is required"],
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0, "Price cannot be negative"],
  },
});

const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Material name is required"],
      trim: true,
      maxlength: [100, "Material name cannot exceed 100 characters"],
    },
    mine_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mine",
      required: true,
    },
    prices: [priceSchema],
    availability_status: {
      type: String,
      enum: ["available", "unavailable"],
      default: "available",
    },
    stock_quantity: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
    },
    photos: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Material || mongoose.model("Material", materialSchema);