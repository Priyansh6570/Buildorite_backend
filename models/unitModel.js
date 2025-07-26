import mongoose from "mongoose";

const unitSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  type: {
    type: String,
    required: true,
    enum: ['weight', 'volume', 'count', 'vehicle', 'package'],
    trim: true
  },
  baseUnit: { type: String, required: true, trim: true },
  multiplier: { type: Number, required: true, min: [0.000001, "Multiplier must be positive"] },
  description: { type: String, trim: true, maxlength: [200, "Description is too long"] },
}, { timestamps: true });

export default mongoose.models.Unit || mongoose.model("Unit", unitSchema);