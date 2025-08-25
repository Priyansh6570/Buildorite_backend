import express from 'express';
import { getUserProfile, updateUserRole, deleteUser, getAllUsers, getUsersByRole, updateUserProfile, updatePushToken, populateOwnerId } from '../controllers/userController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/myprofile').get(protect, getUserProfile);

router.route('/me/pushtoken').patch(protect, updatePushToken);

router.route('/me/populate-owner').get(protect, populateOwnerId);

router.route('/admin/users').get(protect, authorizeRoles('driver'), (req, res, next) => {
    if (req.query.role) getUsersByRole(req, res, next);
    else getAllUsers(req, res, next);
  });

router.route('/update').put(protect, updateUserProfile);

router.route('/admin/user/:id')
    .delete(protect, authorizeRoles('admin'), deleteUser)
    .put(protect, authorizeRoles('admin'), updateUserRole);

export default router;