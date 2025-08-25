import mongoose from "mongoose";

const s = new mongoose.Schema(
  {
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, default: "" },
    message: { type: String, required: true },
    payload: { type: Object, default: {} },
    related_request_id: { type: mongoose.Schema.Types.ObjectId, ref: "Request" },
    related_trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
    is_read: { type: Boolean, default: false, index: true },
    read_at: { type: Date },
  },
  { timestamps: true }
);
s.index({ recipient_id: 1, createdAt: -1 });
export default mongoose.model("Notification", s);