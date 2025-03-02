import mongoose from "mongoose";

const mineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Mine name is required"],
      trim: true,
      maxlength: [100, "Mine name cannot exceed 100 characters"],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        index: '2dsphere',
      },
      address: {
        type: String,
        required: [true, "Mine address is required"],
      },
    },    
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    banner_images: [
      {
        type: String,
        required: false,
      },
    ],
    materials: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Material",
        },
    ],
    requests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Request",
      },
    ],
    assigned_trucks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Truck",
      },
    ],
    operational_hours: {
      monday: { open: { type: String, default: "09:00" }, close: { type: String, default: "18:00" } },
      tuesday: { open: { type: String, default: "09:00" }, close: { type: String, default: "18:00" } },
      wednesday: { open: { type: String, default: "09:00" }, close: { type: String, default: "18:00" } },
      thursday: { open: { type: String, default: "09:00" }, close: { type: String, default: "18:00" } },
      friday: { open: { type: String, default: "09:00" }, close: { type: String, default: "18:00" } },
      saturday: { open: { type: String, default: "09:00" }, close: { type: String, default: "18:00" } },
      sunday: { open: { type: String, default: "Closed" }, close: { type: String, default: "Closed" } },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Mine || mongoose.model("Mine", mineSchema);