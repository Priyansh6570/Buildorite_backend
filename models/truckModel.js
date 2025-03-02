import mongoose from 'mongoose';

const truckSchema = new mongoose.Schema({
  truck_owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  driver_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  registration_number: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  current_location: {
    type: {
      lat: { type: Number, required: true },
      long: { type: Number, required: true },
    },
    required: true,
  },
  status: {
    type: String,
    enum: ['idle', 'on_trip', 'unavailable'],
    default: 'idle',
  },
  assigned_trip_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
  },
}, { timestamps: true });

export default mongoose.model('Truck', truckSchema);