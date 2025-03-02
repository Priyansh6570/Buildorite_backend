import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import catchAsyncError from './catchAsyncError.js';
import ErrorHandler from '../utils/errorHandler.js';

export const protect = catchAsyncError(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if(!token) return next(new ErrorHandler('Login first to access this resource', 401));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    return next(new ErrorHandler('Invalid Token', 401));
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