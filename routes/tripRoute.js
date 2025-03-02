import express from 'express';
import { createTrip, getMyTrips, updateMilestone, updateTripStatus, viewTrip } from '../controllers/tripController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').post(protect, authorizeRoles('truck_owner', 'mine_owner'), createTrip).get(protect, getMyTrips);

router.route('/:id').get(protect, viewTrip);

router.route('/:id/milestone').put(protect, authorizeRoles('driver'), updateMilestone);

router.route('/:id/status').put(protect, authorizeRoles('truck_owner', 'mine_owner'), updateTripStatus);

export default router;