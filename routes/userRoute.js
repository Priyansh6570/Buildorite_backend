import express from 'express';
import { getUserProfile, updateUserRole, deleteUser, getAllUsers, getUsersByRole } from '../controllers/userController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/myprofile').get(protect, getUserProfile);

router.route('/admin/users').get(protect, authorizeRoles('admin'), (req, res, next) => {
    if (req.query.role) getUsersByRole(req, res, next);
    else getAllUsers(req, res, next);
  });

router.route('/admin/user/:id')
    .delete(protect, authorizeRoles('admin'), deleteUser)
    .put(protect, authorizeRoles('admin'), updateUserRole);

export default router;