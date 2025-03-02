import { applyQuery } from "../middleware/queryMiddleware.js";
import { sendNotification } from "../server.js";
import Notification from "../models/notificationModel.js";
import catchAsyncError from "../middleware/catchAsyncError.js";

// Create new notification (to be called within other controllers)
export const createNotification = async ({ recipient_id, type, message, related_request_id = null, related_trip_id = null }) => {
  try {
    const notification = await Notification.create({
      recipient_id,
      type,
      message,
      related_request_id,
      related_trip_id,
    });

    sendNotification(recipient_id.toString(), {
      _id: notification._id,
      type,
      message,
      related_request_id,
      related_trip_id,
      createdAt: notification.createdAt,
      isRead: Notification.is_read,
    });

  } catch (err) {
    console.error('Error creating notification:', err.message);
  }
};

// Get notifications -> GET /api/v1/notifications
export const getNotifications = applyQuery(Notification);

// Mark as read -> PATCH /api/v1/notifications/:id
export const markAsRead = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  await Notification.findByIdAndUpdate(id, { is_read: true });
  res.status(200).json({ success: true, message: "Notification marked as read" });
});