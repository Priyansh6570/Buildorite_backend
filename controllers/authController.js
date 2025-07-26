import User from "../models/userModel.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { sendTokens } from "../utils/jwtToken.js";

// Check if user exists -> api/v1/auth/check-user
export const checkUser = catchAsyncError(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return next(new ErrorHandler("Phone number is required", 400));

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

  const emailCheck = await User.findOne({ email });
  if (emailCheck)
    return next(new ErrorHandler("User with this Email already exists", 400));

  if (role === "driver") {
    const existingDriver = await User.findOne({ phone, role: "driver" });

    if (!existingDriver)
      return next(new ErrorHandler("Driver not invited or doesn't exist", 404));

    existingDriver.name = name;
    existingDriver.email = email;
    existingDriver.isRegistered = true;
    await existingDriver.save();

    return sendTokens(existingDriver, 200, res);
  }

  const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
  if (existingUser)
    return next(
      new ErrorHandler("User with this Email or Phone already exists", 400)
    );

  const user = await User.create({ name, email, phone, role });

  sendTokens(user, 201, res);
});

// Register a new driver -> api/v1/auth/register-driver
export const registerDriver = catchAsyncError(async (req, res, next) => {
  const { phone, name } = req.body;

  if (!phone) return next(new ErrorHandler("Phone is required", 400));
  if (!name) return next(new ErrorHandler("Name is required", 400));

  const existingDriver = await User.findOne({ phone });

  if (existingDriver) return next(new ErrorHandler("User already exists", 400));
  const owner = req.user.id;
  const user = await User.create({
    phone,
    name,
    role: "driver",
    owner_id: owner,
  });
  await User.findByIdAndUpdate(owner, {
    $push: { driver_ids: user._id },
  });
  console.log("Driver registered:", user);
  sendTokens(user, 201, res);
});

// Login user -> api/v1/auth/login
export const loginUser = catchAsyncError(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return next(new ErrorHandler("Phone number is required", 400));
  const user = await User.findOne({ phone });
  if (!user) return next(new ErrorHandler("User not found", 404));
  sendTokens(user, 200, res);
});

// Logout user -> api/v1/auth/logout
export const logoutUser = catchAsyncError(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});
