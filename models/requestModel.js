import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema({
  mine_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mine',
    required: true,
  },
  material_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true,
  },
  truck_owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  truck_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
  },
  delivery_method: {
    type: String,
    enum: ['pickup', 'delivery'],
    required: true,
  },
  delivery_location: {
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
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'canceled', 'completed'],
    default: 'pending',
  },
  pickup_schedule: {
    date: {
      type: Date,
    },
  },
  selected_unit: {
    type: String,
    required: true, 
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  price_confirmed: {
    type: Number,
    required: true,
    min: [0, 'Price must be a positive number'],
  },
  comments: {
    type: String,
    trim: true,
  },
  rejection_reason: {
    type: String,
    trim: true,
  },
  cancellation_reason: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model('Request', requestSchema);