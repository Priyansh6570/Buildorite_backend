import mongoose from 'mongoose';

const milestoneEntrySchema = new mongoose.Schema({
    status: {
        type: String,
        enum: [
            'trip_assigned',
            'trip_started',
            'arrived_at_pickup',
            'loading_complete',
            'pickup_verified',
            'en_route_to_delivery',
            'arrived_at_delivery',
            'delivery_complete',
            'delivery_verified'
        ],
        required: true,
    },
    timestamp: { type: Date, default: Date.now },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], index: '2dsphere' },
    },
}, { _id: false });

const tripSchema = new mongoose.Schema({
    request_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Request',
        required: true,
        index: true,
    },
    truck_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Truck', required: true },
    driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Mine', required: true },

    destination: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: { type: [Number], required: true },
        address: { type: String, required: true },
    },
    trip_type: { type: String, enum: ['pickup', 'delivery'], required: true },
    
    live_location: {
        type: {
            type: String, enum: ['Point'], default: 'Point'
        },
        coordinates: { type: [Number], index: '2dsphere' },
        timestamp: { type: Date }
    },
    status: { type: String, enum: ['active', 'completed', 'canceled', 'issue_reported'], default: 'active' },

    cancel_reason: {
        type: String
    },

    milestone_history: [milestoneEntrySchema],

    issue: {
        reported_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, enum: ['accident', 'vehicle_breakdown', 'unable_to_load', 'delivery_issue'] },
        notes: { type: String },
        timestamp: { type: Date },
    },
    started_at: { type: Date, default: Date.now },
    completed_at: { type: Date },
});

const Trip = mongoose.model('Trip', tripSchema);
export default Trip;