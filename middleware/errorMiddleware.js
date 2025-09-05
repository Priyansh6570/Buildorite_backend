import ErrorHandler from "../utils/errorHandler.js";
import fs from "fs";
import path from "path";

const logFilePath = path.join(process.cwd(), "logs", "error.log");

const logErrorToFile = (err) => {
  const logEntry = `[${new Date().toISOString()}] ${err.statusCode || 500} - ${err.message}\n`;

  fs.appendFile(logFilePath, logEntry, (error) => {
    if (error) console.error("Failed to write error log:", error);
  });
};

export default (err, req, res, next) => {
  if (!(err instanceof ErrorHandler)) {
    err = new ErrorHandler(err.message || "Internal Server Error", err.statusCode || 500);
  }

  if (err.name === "CastError") {
    err = new ErrorHandler(`Resource not found. Invalid: ${err.path}`, 400);
  }
  if (err.code === 11000) {
    err = new ErrorHandler(`Duplicate ${Object.keys(err.keyValue)} entered`, 400);
  }
  if (err.name === "ValidationError") {
    err = new ErrorHandler(
      Object.values(err.errors)
        .map((val) => val.message)
        .join(", "),
      400
    );
  }

  if (err.name === "JsonWebTokenError") {
    err = new ErrorHandler("Invalid token. Please Try Again!!!.", 401);
  }
  if (err.name === "TokenExpiredError") {
    err = new ErrorHandler("Your session has expired. Please Try Again!!!.", 401);
  }

  if (process.env.NODE_ENV === "production") {
    logErrorToFile(err);
    err.message = "Something went wrong. Please try again later.";
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};
