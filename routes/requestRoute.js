import express from "express";
import {
  createRequest,
  getMyRequests,
  getRequestById,
  submitProposal,
  updateRequestStatus,
  assignDriver,
  markAsCompleted,
  getRequestCount
} from "../controllers/requestController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router
  .route("/")
  .post(authorizeRoles("truck_owner"), createRequest)
  .get(getMyRequests);

router.route("/count").get(getRequestCount);

router
  .route("/:id")
  .get(getRequestById);

router.route("/:id/proposal").patch(submitProposal);

router.route("/:id/status").patch(updateRequestStatus);

router.route("/:id/assign-driver").patch(assignDriver);

router.route("/:id/complete").patch(markAsCompleted);

export default router;
