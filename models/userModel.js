import mongoose from "mongoose";
import isEmail from "validator/lib/isEmail.js";
import isMobilePhone from "validator/lib/isMobilePhone.js";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter your name"],
    trim: true,
    maxlength: [50, "Name cannot exceed 50 characters"],
  },
  email: {
    type: String,
    trim: true,
    unique: true,
    validator: [isEmail, "Please enter a valid email address"],
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    unique: true,
    validator: [
      isMobilePhone, "Please enter a valid phone number",
    ],
  },
  role: {
    type: String,
    enum: ["mine_owner", "truck_owner", "driver", "admin"],
    required: true,
  },
  wallet_balance: {
    type: Number,
    default: 0,
    min: [0, "Wallet balance cannot be negative"],
  },
  mine_id: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mine",
  }],
  truck_ids: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Truck",
    },
  ],
  assigned_trip_id: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trip",
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.User || mongoose.model("User", userSchema);
