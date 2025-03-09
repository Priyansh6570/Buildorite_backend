import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { sendTokens } from "../utils/jwtToken.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwtToken.js";

// logic to refresh access token -> api/v1/auth/refresh-token
export const refreshAccessToken = catchAsyncError(async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;

  if(!refreshToken) return next(new ErrorHandler("Refresh token not provided", 403));

  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);
    if(!user) return next(new ErrorHandler("User not found", 403));

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    return next(new ErrorHandler("Invalid or expired refresh token", 403));
  }
});

// Check if user exists -> api/v1/auth/check-user
export const checkUser = catchAsyncError(async (req, res, next) => {
  console.log("supp!!");
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
      new ErrorHandler("User with this phone already exists", 400)
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
  if(!req.cookies.refreshToken) return next(new ErrorHandler('You are not logged in', 401));

  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});
