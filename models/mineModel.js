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
        url: { type: String, required: true },
        public_id: { type: String, required: true },
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
      monday: {
        open: { type: String, default: null },
        close: { type: String, default: null },
      },
      tuesday: {
        open: { type: String, default: null },
        close: { type: String, default: null },
      },
      wednesday: {
        open: { type: String, default: null },
        close: { type: String, default: null },
      },
      thursday: {
        open: { type: String, default: null },
        close: { type: String, default: null },
      },
      friday: {
        open: { type: String, default: null },
        close: { type: String, default: null },
      },
      saturday: {
        open: { type: String, default: null },
        close: { type: String, default: null },
      },
      sunday: {
        open: { type: String, default: null },
        close: { type: String, default: null },
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Mine || mongoose.model("Mine", mineSchema);