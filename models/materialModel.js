import mongoose from "mongoose";

const priceSchema = new mongoose.Schema({
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Unit",
    required: [true, "A valid unit is required"],
  },
  price: { type: Number, required: true, min: [0, "Price cannot be negative"] },
  stock_quantity: {
    type: Number,
    required: true,
    min: [0, "Stock cannot be negative"],
  },
  minimum_order_quantity: {
    type: Number,
    default: 1,
    min: [1, "MOQ must be at least 1"],
  },
});

const materialPropertySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true },
});

const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Name is too long"],
    },
    mine_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mine",
      required: true,
    },
    prices: [priceSchema],
    properties: [materialPropertySchema],
    availability_status: {
      type: String,
      enum: ["available", "unavailable", "limited"],
      default: "available",
    },
    photos: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true },
        caption: String,
      },
    ],
    description: { type: String, maxlength: [500, "Description is too long"] },
    tags: [{ type: String, trim: true, maxlength: [50, "Tag is too long"] }],
    views: { type: Number, default: 0 },
    orders_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

materialSchema.index({ name: "text", description: "text", tags: "text" });
materialSchema.index({ mine_id: 1, availability_status: 1 });

export default mongoose.models.Material ||
  mongoose.model("Material", materialSchema);
