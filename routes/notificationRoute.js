import express from "express";
import { getNotifications, markAsRead, markAllAsRead, unreadCount } from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/").get(protect, getNotifications);
router.route("/unread-count").get(protect, unreadCount);
router.route("/mark-all").patch(protect, markAllAsRead);
router.route("/:id").patch(protect, markAsRead);

export default router;