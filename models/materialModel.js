import mongoose from "mongoose";

const priceSchema = new mongoose.Schema({
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: [0, "Quantity cannot be negative"],
  },
  unit: {
    type: String,
    // enum: ["ton", "kg", "cubic_meter", "litre", "piece"],
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
        type: String,
        required: false,
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Material || mongoose.model("Material", materialSchema);