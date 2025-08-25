import express from "express";
import { getMyTrips, getTripById, updateMilestone, verifyMilestone, updateLiveLocation, reportIssue, getMineOwnerAnalytics, getTruckOwnerAnalytics, getUserTripCounts } from "../controllers/tripController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/").get(protect, getMyTrips);

router.route("/:id").get(protect, getTripById);

router.route("/stats/trip-count").get(protect, getUserTripCounts);

router.route("/analytics").post(protect, getMineOwnerAnalytics);

router.route("/analytics/truck").post(protect, getTruckOwnerAnalytics);

router.route("/:id/milestone").patch(protect, authorizeRoles("driver"), updateMilestone);

router.route("/:id/verify").patch(protect, authorizeRoles("truck_owner", "mine_owner"), verifyMilestone);

router.route("/:id/location").patch(protect, authorizeRoles("driver"), updateLiveLocation);

router.route("/:id/report-issue").patch(protect, authorizeRoles("driver"), reportIssue);

export default router;
