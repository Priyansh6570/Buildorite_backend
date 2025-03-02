import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "request_created",
        "request_accepted",
        "request_rejected",
        "request_canceled",
        "request_completed",
        "trip_created",
        "trip_update",
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    related_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request",
    },
    related_trip_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
    },
    is_read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);