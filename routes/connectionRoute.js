import express from 'express';
import { sendConnectionRequest, getPendingConnections, rejectConnectionRequest, acceptConnectionRequest } from '../controllers/connectionController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/connection-request').post(protect, authorizeRoles('driver'), sendConnectionRequest);

router.route('/pending-connections').get(protect, authorizeRoles('truck_owner'), getPendingConnections);

router.route('/reject-connection/:id').delete(protect, authorizeRoles('truck_owner'), rejectConnectionRequest);

router.route('/accept-connection/:id').put(protect, authorizeRoles('truck_owner'), acceptConnectionRequest);

export default router;