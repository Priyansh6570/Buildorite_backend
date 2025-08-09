import express from "express";
import {
  createRequest,
  getMyRequests,
  getRequestById,
  submitProposal,
  updateRequestStatus,
  assignDriver,
  markAsCompleted,
} from "../controllers/requestController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes below are protected and require a logged-in user.
router.use(protect);

// Routes for the main request collection
router
  .route("/")
  // POST /api/v1/requests - Create a new request
  .post(authorizeRoles("truck_owner"), createRequest)
  // GET /api/v1/requests - Get all requests for the logged-in user
  .get(getMyRequests);

// Routes for a specific request by its ID
router
  .route("/:id")
  // GET /api/v1/requests/:id - Get a single request's details
  .get(getRequestById);

// Route for submitting a counter-offer or new proposal
// PATCH /api/v1/requests/:id/proposal
router.route("/:id/proposal").patch(submitProposal);

// Route for updating the final status (accept, reject, cancel)
// PATCH /api/v1/requests/:id/status
router.route("/:id/status").patch(updateRequestStatus);

// Route for assigning a driver after a request has been accepted
// PATCH /api/v1/requests/:id/assign-driver
router.route("/:id/assign-driver").patch(assignDriver);

// Route for marking an in-progress request as completed
// PATCH /api/v1/requests/:id/complete
router.route("/:id/complete").patch(markAsCompleted);

export default router;
