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
    sparse: true,
    unique: true,
    validator: [isEmail, "Please enter a valid email address"],
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    unique: true,
    validator: [isMobilePhone, "Please enter a valid phone number"],
  },
  role: {
    type: String,
    enum: ["mine_owner", "truck_owner", "driver", "admin"],
    required: true,
  },
  isRegistered: {
    type: Boolean,
    default: false,
  },
  wallet_balance: {
    type: Number,
    default: 0,
    min: [0, "Wallet balance cannot be negative"],
  },
  mine_id: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mine",
    },
  ],
  driver_ids: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  truck_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Truck",
  },
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  assigned_trip_id: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
    },
  ],
  created_unit_ids: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
    },
  ],
  pushToken: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.User || mongoose.model("User", userSchema);
