import User from "../models/userModel.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { applyQuery } from "../middleware/queryMiddleware.js";

export const updatePushToken = catchAsyncError(async (req, res, next) => {
  const { pushToken } = req.body;
  console.log(`Received push token: ${pushToken}`);
  const userId = req.user.id;
  if (!pushToken) {
    return next(new ErrorHandler("Push token is required.", 400));
  }
  const user = await User.findById(userId);

  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }
  if (user.pushToken !== pushToken) {
    console.log(`Updating push token for user ${userId}.`);
    user.pushToken = pushToken;
    await user.save();
  }

  res.status(200).json({
    success: true,
    message: "Push token status confirmed.",
  });
});

export const getUserProfile = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) return next(new ErrorHandler("User not found", 404));
  res.status(200).json({
    success: true,
    user,
  });
});

export const getAllUsers = applyQuery(User);

export const populateOwnerId = catchAsyncError(async (req, res, next) => {
  const d = await User.findById(req.user.id).select("owner_id").lean();
  if (!d) return next(new ErrorHandler("User not found", 404));
  if (!d.owner_id) return next(new ErrorHandler("Owner not found", 404));
  const o = await User.findById(d.owner_id).select("_id name phone").lean();
  if (!o) return next(new ErrorHandler("Owner not found", 404));
  req.user.owner_id = o._id;
  req.user.owner_name = o.name;
  req.user.owner_phone = o.phone;
  res.status(200).json({ success: true, owner: o });
});

export const updateUserProfile = catchAsyncError(async (req, res, next) => {
  const { name, email, phone } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return next(new ErrorHandler("User not found", 404));
  ("");
  const emailExists = await User.findOne({ email, _id: { $ne: req.user.id } });
  const phoneExists = await User.findOne({ phone, _id: { $ne: req.user.id } });
  if (emailExists) return next(new ErrorHandler("Email already linked to another account", 400));
  if (phoneExists) return next(new ErrorHandler("Phone Number already linked to another account", 400));

  user.name = name || user.name;
  user.email = email || user.email;
  user.phone = phone || user.phone;
  await user.save();
  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user,
  });
});

export const getUsersByRole = catchAsyncError(async (req, res, next) => {
  const { role } = req.query;
  if (!role) return next(new ErrorHandler("Role is required", 400));
  const users = await User.find({ role });
  res.status(200).json({ success: true, users });
});

export const deleteUser = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorHandler("User not found", 404));
  await user.deleteOne();
  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

export const updateUserRole = catchAsyncError(async (req, res, next) => {
  const { role } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) return next(new ErrorHandler("User not found", 404));
  if (!["mine_owner", "truck_owner", "driver", "admin"].includes(role)) return next(new ErrorHandler("Invalid role", 400));

  user.role = role;
  await user.save();

  res.status(200).json({
    success: true,
    message: "User role updated successfully",
    user,
  });
});
