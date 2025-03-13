import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import catchAsyncError from './catchAsyncError.js';
import ErrorHandler from '../utils/errorHandler.js';

export const protect = catchAsyncError(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ErrorHandler("Login first to access this resource", 401));
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return next(new ErrorHandler("User no longer exists", 401));

    req.user = user;
    next();
  } catch (error) {
    return next(new ErrorHandler("Invalid token, please log in again", 401));
  }
});


export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if(req.user && req.user.role === 'admin') return next();

    if(!roles.includes(req.user.role)) {
      return next(
        new ErrorHandler(
          `Role (${req.user.role}) is not allowed to access this resource`,
          403
        )
      );
    }
    next();
  };
};