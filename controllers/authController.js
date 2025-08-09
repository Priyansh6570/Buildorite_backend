import User from "../models/userModel.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { sendTokens } from "../utils/jwtToken.js";
import twilio from "twilio";


// Phone verification -> api/v1/auth/verify-phone
export const verifyPhone = catchAsyncError(async (req, res, next) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken, {
    lazyLoading: true,
  });
  
  const { phone } = req.body;
  
  if (!phone) return next(new ErrorHandler("Phone number is required", 400));
  
  if (!/^\d{10}$/.test(phone)) {
    return next(new ErrorHandler("Please enter a valid 10-digit phone number", 400));
  }
  
  try {
    await client.verify.v2?.services(process.env.TWILIO_SERVICE_SID)
      .verifications.create({
        to: `+91${9755326570}`,
        channel: "sms",
      });
      
    res.status(200).json({ 
      success: true, 
      message: "OTP sent successfully",
      phone: phone
    });
  } catch (error) {
    console.error("Twilio verification error:", error);
    
    // Handle specific Twilio errors
    if (error.code === 60200) {
      return next(new ErrorHandler("Invalid phone number", 400));
    } else if (error.code === 60203) {
      return next(new ErrorHandler("Max send attempts reached", 429));
    }
    
    return next(new ErrorHandler("Failed to send OTP", 500));
  }
});

// OTP verification -> api/v1/auth/verify-otp
export const verifyOtp = catchAsyncError(async (req, res, next) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken, {
    lazyLoading: true,
  });
  
  const { phone, otp } = req.body;
  
  if (!phone || !otp) {
    return next(new ErrorHandler("Phone number and OTP are required", 400));
  }
  
  // Validate inputs
  if (!/^\d{10}$/.test(phone)) {
    return next(new ErrorHandler("Please enter a valid 10-digit phone number", 400));
  }
  
  if (!/^\d{6}$/.test(otp)) {
    return next(new ErrorHandler("Please enter a valid 6-digit OTP", 400));
  }
  
  console.log("Verifying OTP for phone:", phone);
  
  try {
    const verificationCheck = await client.verify.v2?.services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks.create({
        to: `+91${9755326570}`,
        code: otp,
      });
    
    if (verificationCheck.status === "approved") {
      console.log("OTP verified successfully for phone:", phone);
      res.status(200).json({ 
        success: true, 
        message: "OTP verified successfully",
        phoneVerified: true,
        phone: phone
      });
    } else {
      console.error("OTP verification failed:", verificationCheck);
      return next(new ErrorHandler("Invalid OTP", 400));
    }
  } catch (error) {
    console.error("Twilio verification error:", error);
    
    // Handle specific Twilio errors
    if (error.code === 20404) {
      return next(new ErrorHandler("Invalid or expired OTP", 400));
    } else if (error.code === 60202) {
      return next(new ErrorHandler("Max verification attempts reached", 429));
    }
    
    return next(new ErrorHandler("Failed to verify OTP", 500));
  }
});

// Check if user exists -> api/v1/auth/check-user
export const checkUser = catchAsyncError(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return next(new ErrorHandler("Phone number is required", 400));

  const user = await User.findOne({ phone });
  const userExists = !!user;
  const role = user ? user.role : null;
  const name = user ? user.name : null;
  const email = user ? user.email : null;

  res.status(200).json({ success: true, userExists, role, name, email });
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
