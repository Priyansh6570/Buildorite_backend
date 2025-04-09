import User from "../models/userModel.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { sendTokens } from "../utils/jwtToken.js";

// Check if user exists -> api/v1/auth/check-user
export const checkUser = catchAsyncError(async (req, res, next) => {
  const { phone } = req.body;
  if(!phone) return next(new ErrorHandler('Phone number is required', 400));

  const user = await User.findOne({ phone });
  const userExists = !!user;
  const role = user ? user.role : null;
  const name = user ? user.name : null;

  res.status(200).json({ success: true, userExists, role, name });
});

// Register a new user -> api/v1/auth/register
export const registerUser = catchAsyncError(async (req, res, next) => {
  const { name, email, phone, role } = req.body;

  if (!name) return next(new ErrorHandler("Name is required", 400));
  if (!email) return next(new ErrorHandler("Email is required", 400));
  if (!phone) return next(new ErrorHandler("Phone is required", 400));
  if (!role) return next(new ErrorHandler("Role is required", 400));

  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser)
    return next(
      new ErrorHandler("User with this Email already exists", 400)
    );

  const user = await User.create({
    name,
    email,
    phone,
    role,
  });

  sendTokens(user, 201, res);
});

// Login user -> api/v1/auth/login
export const loginUser = catchAsyncError(async (req, res, next) => {

  const { phone } = req.body;
  if(!phone) return next(new ErrorHandler('Phone number is required', 400));
  const user = await User.findOne({ phone });
  if (!user) return next(new ErrorHandler('User not found', 404));
  sendTokens(user, 200, res);
});

// Logout user -> api/v1/auth/logout
export const logoutUser = catchAsyncError(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});
