import User from '../models/userModel.js';
import catchAsyncError from '../middleware/catchAsyncError.js';
import ErrorHandler from '../utils/errorHandler.js';
import { applyQuery } from '../middleware/queryMiddleware.js';

// Get user profile -> api/v1/user/myprofile
export const getUserProfile = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if(!user) return next(new ErrorHandler('User not found', 404));
  res.status(200).json({
    success: true,
    user,
  });
});

// Get all users (Admin only) -> /admin/users
export const getAllUsers = applyQuery(User);

// Update user profile (name, email, phone) -> api/v1/user/update
export const updateUserProfile = catchAsyncError(async (req, res, next) => {
  const { name, email, phone } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return next(new ErrorHandler('User not found', 404));
  user.name = name || user.name;
  user.email = email || user.email;
  user.phone = phone || user.phone;
  await user.save();
  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    user,
  });
});

// Get all users by role (Admin only) -> /admin/users?role=role
export const getUsersByRole = catchAsyncError(async (req, res, next) => {
    const { role } = req.query;
    if (!role) return next(new ErrorHandler('Role is required', 400));
    const users = await User.find({ role });
    res.status(200).json({ success: true, users });
  });

// Delete user (Admin only) -> /admin/user/:id
export const deleteUser = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorHandler('User not found', 404));
  await user.deleteOne();
  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

// Update user role (Admin only) -> /admin/user/:id
export const updateUserRole = catchAsyncError(async (req, res, next) => {
  const { role } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) return next(new ErrorHandler('User not found', 404));
  if (!['mine_owner', 'truck_owner', 'driver', 'admin'].includes(role)) return next(new ErrorHandler('Invalid role', 400));

  user.role = role;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'User role updated successfully',
    user,
  });
});