import mongoose from "mongoose";

const materialViewSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  material_id: { type: mongoose.Schema.Types.ObjectId, ref: "Material", required: true },
  last_viewed: { type: Date, default: Date.now }
});

materialViewSchema.index({ user_id: 1, material_id: 1 }, { unique: true });

export default mongoose.models.MaterialView ||
  mongoose.model("MaterialView", materialViewSchema);