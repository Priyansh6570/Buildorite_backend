import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema({
  truck_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
    required: true,
  },
  mine_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mine',
    required: true,
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
      required: [true, "Destination address is required"],
    },
  },
  trip_type: {
    type: String,
    enum: ['pickup', 'delivery'],
    required: true,
  },  
  current_milestone: {
    type: String,
    enum: [
      'on_route_to_pickup', 'arrived_at_mine', 'loaded_material', 
      'on_route_to_destination', 'delivered'
    ],
    default: 'on_route_to_pickup',
  },  
  status: {
    type: String,
    enum: ['active', 'completed', 'canceled'],
    default: 'active',
  },  
  cancel_reason: {
    type: String,
  },
  verified_by_mine_owner: {
    type: Boolean,
    default: false,
  },
  started_at: {
    type: Date,
    default: Date.now,
  },
  completed_at: {
    type: Date,
  },
});

const Trip = mongoose.model('Trip', tripSchema);
export default Trip;