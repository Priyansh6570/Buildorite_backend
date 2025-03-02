import express from 'express';
import { cancelRequest, getMyRequests, acceptRequest, rejectRequest, editRequest, createRequest } from '../controllers/requestController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, authorizeRoles('truck_owner'), createRequest)
    .get(protect, getMyRequests);

router.route('/:id/cancel').patch(protect, cancelRequest);

router.route('/:id/accept').patch(protect, authorizeRoles('mine_owner'), acceptRequest);

router.route('/:id/reject').patch(protect, authorizeRoles('mine_owner'), rejectRequest);

router.route('/:id').patch(protect, editRequest);

export default router;