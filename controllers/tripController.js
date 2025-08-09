import Trip from '../models/tripModel.js';
import Request from '../models/requestModel.js';
import Truck from '../models/truckModel.js';
import User from '../models/userModel.js';
import catchAsyncError from '../middleware/catchAsyncError.js';
import ErrorHandler from '../utils/errorHandler.js';
import { createNotification } from './notificationController.js';

export const createTripForRequest = async (requestId, driverId) => {
    const request = await Request.findById(requestId)
        .populate('mine_id', 'location')
        .populate('material_id', 'name');

    if (!request || request.status !== 'in_progress') {
        throw new Error('Trip can only be created for an in-progress request.');
    }

    const driver = await User.findById(driverId);
    if (!driver || !driver.truck_id) {
        throw new Error('Selected driver is not valid or has no truck assigned.');
    }

    // --- **NEW**: Dynamically determine the destination ---
    let destination = request.finalized_agreement.delivery_location;

    // Validate that a destination was successfully determined
    if (!destination || !destination.coordinates || !destination.address) {
        throw new Error('Destination location for the trip could not be determined.');
    }

    const trip = await Trip.create({
        request_id: requestId,
        truck_id: driver.truck_id,
        driver_id: driverId,
        mine_id: request.mine_id._id,
        destination: destination,
        trip_type: request.finalized_agreement.delivery_method,
        milestone_history: [{ status: 'trip_assigned' }],
    });

    // Update truck and driver status to 'on_trip'
    await Truck.findByIdAndUpdate(driver.truck_id, { status: 'on_trip', assigned_trip_id: trip._id });
    await User.findByIdAndUpdate(driverId, { $push: { assigned_trip_id: trip._id } });

    // --- Create Notifications ---
    await createNotification({
        recipient_id: driverId,
        type: "trip_assigned",
        message: `You have a new trip for ${request.material_id.name}.`,
        related_trip_id: trip._id,
    });
    
    const otherPartyId = request.truck_owner_id;
    await createNotification({
        recipient_id: otherPartyId,
        type: "trip_started",
        message: `The trip for your request has started.`,
        related_trip_id: trip._id,
    });

    return trip;
};


/**
 * @route   GET /api/v1/trips
 * @desc    Get all trips for the logged-in user (Driver, Truck Owner, Mine Owner)
 * @access  Private
 */
export const getMyTrips = catchAsyncError(async (req, res, next) => {
    const { _id, role, mine_id } = req.user;
    let query = {};

    if (role === 'driver') {
        query = { driver_id: _id };
    } else if (role === 'truck_owner') {
        const userWithTrucks = await User.findById(_id).populate('truck_id');
        const truckIds = userWithTrucks.truck_id.map(t => t._id);
        query = { truck_id: { $in: truckIds } };
    } else if (role === 'mine_owner') {
        query = { mine_id: { $in: mine_id } };
    }

    const trips = await Trip.find(query)
        .populate({
            path: 'request_id',
            select: 'material_id finalized_agreement',
            populate: { path: 'material_id', select: 'name' }
        })
        .populate('truck_id', 'name registration_number')
        .populate('driver_id', 'name')
        .sort({ started_at: -1 });

    res.status(200).json({ success: true, count: trips.length, data: trips });
});


/**
 * @route   GET /api/v1/trips/:id
 * @desc    Get a single trip by its ID with full details
 * @access  Private
 */
export const getTripById = catchAsyncError(async (req, res, next) => {
    const trip = await Trip.findById(req.params.id)
        .populate({
            path: 'request_id',
            populate: [
                { path: 'material_id', select: 'name' },
                { path: 'mine_id', select: 'name location' },
                { path: 'truck_owner_id', select: 'name' },
                { path: 'finalized_agreement.unit', select: 'name' }
            ]
        })
        .populate('truck_id', 'name registration_number')
        .populate('driver_id', 'name phone');

    if (!trip) {
        return next(new ErrorHandler('Trip not found', 404));
    }

    // Authorization check can be added here to ensure user is part of the trip

    res.status(200).json({ success: true, data: trip });
});


/**
 * @route   PATCH /api/v1/trips/:id/milestone
 * @desc    Update a trip milestone (for Drivers)
 * @access  Private (Driver)
 */
export const updateMilestone = catchAsyncError(async (req, res, next) => {
    const { status, location } = req.body;

    const trip = await Trip.findById(req.params.id);
    if (!trip) return next(new ErrorHandler('Trip not found', 404));

    if (trip.driver_id.toString() !== req.user._id.toString()) {
        return next(new ErrorHandler('You are not authorized to update this trip.', 403));
    }

    const newMilestone = { status, timestamp: new Date() };
    if (location) {
        newMilestone.location = { type: 'Point', coordinates: location.coordinates };
    }

    trip.milestone_history.push(newMilestone);

    // If trip is completed by driver, update status but wait for verification
    if (status === 'delivery_complete') {
        trip.completed_at = new Date();
    }
    await trip.save();

    res.status(200).json({ success: true, data: trip });
});


/**
 * @route   PATCH /api/v1/trips/:id/verify
 * @desc    Verify a milestone (for Mine/Truck Owners)
 * @access  Private (Mine Owner, Truck Owner)
 */
export const verifyMilestone = catchAsyncError(async (req, res, next) => {
    const { status } = req.body; // e.g., 'pickup_verified' or 'delivery_verified'

    const trip = await Trip.findById(req.params.id).populate('request_id');
    if (!trip) return next(new ErrorHandler('Trip not found', 404));

    const isMineOwner = req.user.mine_id.includes(trip.mine_id.toString());
    const isTruckOwner = req.user._id.toString() === trip.request_id.truck_owner_id.toString();

    let canVerify = false;
    if (status === 'pickup_verified' && isMineOwner) canVerify = true;
    if (status === 'delivery_verified' && isTruckOwner) canVerify = true;

    if (!canVerify) {
        return next(new ErrorHandler('You are not authorized to verify this milestone.', 403));
    }

    trip.milestone_history.push({ status, timestamp: new Date() });

    // If final verification, mark trip as completed
    if (status === 'delivery_verified') {
        trip.status = 'completed';
        // Also update the original request status
        await Request.findByIdAndUpdate(trip.request_id, { status: 'completed' });
        // Make truck and driver available again
        await Truck.findByIdAndUpdate(trip.truck_id, { status: 'idle', $unset: { assigned_trip_id: 1 } });
        await User.findByIdAndUpdate(trip.driver_id, { $pull: { assigned_trip_id: trip._id } });
    }

    await trip.save();

    res.status(200).json({ success: true, data: trip });
});


/**
 * @route   PATCH /api/v1/trips/:id/location
 * @desc    Update live location of the truck (for Drivers)
 * @access  Private (Driver)
 */
export const updateLiveLocation = catchAsyncError(async (req, res, next) => {
    const { coordinates } = req.body;

    console.log('Updating live location for trip:', req.params.id, 'with coordinates:', coordinates);

    const trip = await Trip.findByIdAndUpdate(
        req.params.id,
        { live_location: { type: 'Point', coordinates, timestamp: new Date() } },
        { new: true }
    );

    if (!trip) return next(new ErrorHandler('Trip not found', 404));

    res.status(200).json({ success: true, message: 'Location updated.' });
});


/**
 * @route   PATCH /api/v1/trips/:id/report-issue
 * @desc    Report an issue with the trip (for Drivers)
 * @access  Private (Driver)
 */
export const reportIssue = catchAsyncError(async (req, res, next) => {
    const { reason, notes } = req.body;

    const trip = await Trip.findById(req.params.id);
    if (!trip) return next(new ErrorHandler('Trip not found', 404));

    trip.status = 'issue_reported';
    trip.issue = {
        reported_by: req.user._id,
        reason,
        notes,
        timestamp: new Date(),
    };

    await trip.save();

    // High-priority notifications to owners
    // ... notification logic here ...

    res.status(200).json({ success: true, message: 'Issue reported successfully.', data: trip });
});