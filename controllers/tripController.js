import Trip from '../models/tripModel.js';
import Truck from '../models/truckModel.js';
import Mine from '../models/mineModel.js';
import catchAsyncError from '../middleware/catchAsyncError.js';
import ErrorHandler from '../utils/errorHandler.js';
import { createNotification } from './notificationController.js';

// Create a new trip when a truck is assigned -> POST /api/trips
export const createTrip = catchAsyncError(async (req, res, next) => {
  const { truck_id, mine_id, location, trip_type } = req.body;

  if(!truck_id || !mine_id || !location || !trip_type) return next(new ErrorHandler('All required fields must be provided', 400));

  const trip = await Trip.create({
    truck_id,
    mine_id,
    location,
    trip_type,
    current_milestone: 'on_route_to_pickup',
  });

  const truck = await Truck.findById(truck_id).populate('owner_id driver_id');
  const mine = await Mine.findById(mine_id).populate('owner_id');

  // Notifications
  if (trip_type === 'delivery') {
    await createNotification({
      recipient_id: truck.owner_id._id,
      type: "trip_created",
      message: `A new delivery trip has been created for your truck.`,
      related_trip_id: trip._id,
    });
  } else if (trip_type === 'pickup') {
    await createNotification({
      recipient_id: mine.owner_id._id,
      type: "trip_created",
      message: `A new pickup trip has been scheduled for your mine.`,
      related_trip_id: trip._id,
    });
  }
  if (truck.driver_id) {
    await createNotification({
      recipient_id: truck.driver_id._id,
      type: "trip_created",
      message: `You have been assigned a new trip.`,
      related_trip_id: trip._id,
    });
  }

  res.status(201).json({ success: true, data: trip });
});

// View a particular trip with details -> GET /api/trips/:id
export const viewTrip = catchAsyncError(async (req, res, next) => {
    const { id } = req.params;
  
    const trip = await Trip.findById(id)
      .populate({ path: 'truck_id', populate: { path: 'truck_owner_id' } })
      .populate('mine_id');
  
    if (!trip) return next(new ErrorHandler('Trip not found', 404));
  
    const driver = await Truck.findById(trip.truck_id).populate('driver_id');
  
    res.status(200).json({
      success: true,
      data: {
        trip,
        truck_owner: trip.truck_id.truck_owner_id,
        mine: trip.mine_id,
        driver: driver.driver_id,
      },
    });
  });

// Get all trips for the logged-in user -> GET /api/trips
export const getMyTrips = catchAsyncError(async (req, res, next) => {
  const user = req.user;

  let trips = [];
  if (user.role === 'truck_owner') {
    const trucks = await Truck.find({ truck_owner_id: user._id });
    const truckIds = trucks.map((truck) => truck._id);
    trips = await Trip.find({ truck_id: { $in: truckIds } }).populate('truck_id mine_id');
  } else if (user.role === 'mine_owner') {
    trips = await Trip.find({ mine_id: user.mine_id }).populate('truck_id mine_id');
  } else if (user.role === 'driver') {
    const trucks = await Truck.find({ driver_id: user._id });
    const truckIds = trucks.map((truck) => truck._id);
    trips = await Trip.find({ truck_id: { $in: truckIds } }).populate('truck_id mine_id');
  }

  res.status(200).json({ success: true, data: trips });
});

// Update trip milestones (for drivers) -> PUT /api/trips/:id/milestone
export const updateMilestone = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { current_milestone } = req.body;

  const validMilestones = [
    'on_route_to_pickup', 'arrived_at_mine', 'loaded_material', 
    'on_route_to_destination', 'delivered', 'on_route_to_delivery'
  ];

  if(!validMilestones.includes(current_milestone)) return next(new ErrorHandler('Invalid milestone', 400));

  const trip = await Trip.findByIdAndUpdate(id, { current_milestone }, { new: true });

  if(!trip) return next(new ErrorHandler('Trip not found', 404));

  const truck = await Truck.findById(trip.truck_id).populate('owner_id driver_id');
  const mine = await Mine.findById(trip.mine_id).populate('owner_id');

  // Notify Mine Owner
  await createNotification({
    recipient_id: mine.owner_id._id,
    type: "trip_update",
    message: `Trip milestone updated to '${current_milestone}'.`,
    related_trip_id: trip._id,
  });

  // Notify Truck Owner
  await createNotification({
    recipient_id: truck.owner_id._id,
    type: "trip_update",
    message: `Your truck's trip milestone is now '${current_milestone}'.`,
    related_trip_id: trip._id,
  });

  res.status(200).json({ success: true, data: trip });
});

// Complete or cancel trip (for truck owners) -> PUT /api/trips/:id/status
export const updateTripStatus = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { status, cancel_reason } = req.body;

  if(!['completed', 'canceled'].includes(status)) return next(new ErrorHandler('Invalid status', 400));

  const updateData = { status };
  if (status === 'completed') updateData.completed_at = Date.now();
  if (status === 'canceled') updateData.cancel_reason = cancel_reason;

  const trip = await Trip.findByIdAndUpdate(id, updateData, { new: true });

  if(!trip) return next(new ErrorHandler('Trip not found', 404));

  const truck = await Truck.findById(trip.truck_id).populate('owner_id driver_id');
  const mine = await Mine.findById(trip.mine_id).populate('owner_id');

  const message = status === 'completed' 
    ? `The trip has been marked as completed.` 
    : `The trip has been canceled. Reason: ${cancel_reason || 'No reason provided'}.`;

  await createNotification({
    recipient_id: mine.owner_id._id,
    type: 'trip_update',
    message,
    related_trip_id: trip._id,
  });

  await createNotification({
    recipient_id: truck.owner_id._id,
    type: 'trip_update',
    message,
    related_trip_id: trip._id,
  });

  if (truck.driver_id) {
    await createNotification({
      recipient_id: truck.driver_id._id,
      type: 'trip_update',
      message,
      related_trip_id: trip._id,
    });
  }

  res.status(200).json({ success: true, data: trip });
});