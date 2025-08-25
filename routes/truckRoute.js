import express from 'express';
import { createTruck, getMyTruck, getTrucksByOwner, updateTruck, deleteTruck, removeTruck, getMyDrivers, getDriverDetails } from '../controllers/truckController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/create-truck').post(protect, authorizeRoles('driver'), createTruck);

router.route('/my-truck').get(protect, authorizeRoles('driver'), getMyTruck);

router.route('/my-drivers').get(protect, getMyDrivers);

router.route('/driver/:driverId').get(protect, getDriverDetails);

router.route('/trucks-by-owner').get(protect, authorizeRoles('truck_owner'), getTrucksByOwner);

router.route('/truck/:id').put(protect, authorizeRoles('driver'), updateTruck).delete(protect, authorizeRoles('driver'), deleteTruck);

router.route('/remove-truck/:id').post(protect, authorizeRoles('truck_owner'), removeTruck);

export default router;
