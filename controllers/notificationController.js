import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import { Expo } from "expo-server-sdk";
const expo = new Expo();

export const createNotification = async ({ recipient_id, type, title, message, payload = {} }) => {
  const n = await Notification.create({
    recipient_id,
    type,
    title,
    message,
    payload,
  });

  const u = await User.findById(recipient_id).select("pushToken");
  if (u?.pushToken && Expo.isExpoPushToken(u.pushToken)) {
    const msg = {
      to: u.pushToken,
      title,
      body: message,
      data: {
        type,
        payload, 
        notification_id: n._id.toString(),
      },
      priority: "high",
    };
    await expo.sendPushNotificationsAsync([msg]);
  }

  return n;
};

export const getNotifications = catchAsyncError(async (req, res) => {
  const { cursor, limit = 20 } = req.query;
  const q = { recipient_id: req.user._id };
  if (cursor) q.createdAt = { $lt: new Date(cursor) };
  const list = await Notification.find(q).sort({ createdAt: -1 }).limit(+limit);
  res.json({ list, nextCursor: list.at(-1)?.createdAt ?? null });
});

export const markAsRead = catchAsyncError(async (req, res) => {
  const { id } = req.params;
  await Notification.updateOne({ _id: id, recipient_id: req.user._id }, { is_read: true, read_at: new Date() });
  res.json({ success: true });
});

export const markAllAsRead = catchAsyncError(async (req, res) => {
  await Notification.updateMany({ recipient_id: req.user._id, is_read: false }, { is_read: true, read_at: new Date() });
  res.json({ success: true });
});

export const unreadCount = catchAsyncError(async (req, res) => {
  const c = await Notification.countDocuments({ recipient_id: req.user._id, is_read: false });
  res.json({ count: c });
});