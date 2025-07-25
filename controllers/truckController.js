import catchAsyncError from '../middleware/catchAsyncError.js';
import ErrorHandler from "../utils/errorHandler.js";
import Truck from '../models/truckModel.js';
import User from '../models/userModel.js';

// Create a new truck -> /create-truck
export const createTruck = catchAsyncError(async (req, res, next) => {
  try {
    const { name, registration_number, current_location } = req.body;
    const driver_id = req.user._id;

    const truck = await Truck.create({
      name,
      registration_number,
      current_location,
      driver_id,
    });

    await User.findByIdAndUpdate(driver_id, { truck_id: truck._id });

    res.status(201).json({ success: true, data: truck });
  } catch (error) {
    next(error);
  }
});

// Get details -> /my-truck
export const getMyTruck = catchAsyncError(async (req, res, next) => {
  try{
    const truck = await Truck.findOne({ driver_id: req.user._id }).populate({
      path: 'truck_owner_id',
      select: 'name',
    });
    
    res.status(200).json({ success: true, data: truck });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
  
// Get all drivers of the owner -> /my-drivers
export const getMyDrivers = catchAsyncError(async (req, res, next) => {
  console.log('Fetching my drivers...');
  try {
    const ownerId = req.user._id;

    const owner = await User.findById(ownerId).populate({
      path: 'driver_ids',
      populate: {
        path: 'truck_id',
      },
    });

    if (!owner) return next(new ErrorHandler('Owner not found', 404));

    res.status(200).json({
      success: true,
      data: owner.driver_ids,
    });
  } catch (error) {
    next(error);
  }
});

// Get all trucks for a specific truck owner -> /trucks-by-owner
export const getTrucksByOwner = catchAsyncError(async (req, res, next) => {
  try {
    const truck_owner_id = req.user._id;
    const trucks = await Truck.find({ truck_owner_id });
    res.status(200).json({ success: true, data: trucks });
  } catch (error) {
    next(error);
  }
});

// Update truck details -> /truck/:id
export const updateTruck = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const truck = await Truck.findByIdAndUpdate(id, updates, { new: true });
    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });

    res.status(200).json({ success: true, data: truck });
  } catch (error) {
    next(error);
  }
});

// Delete a truck -> /truck/:id
export const deleteTruck = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;
    const truck = await Truck.findByIdAndDelete(id);

    if (!truck) return res.status(404).json({ success: false, message: 'Truck not found' });

    await User.findByIdAndUpdate(truck.truck_owner_id, { $pull: { truck_ids: id } });

    res.status(200).json({ success: true, message: 'Truck deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Remove truck -> /truck/:id
export const removeTruck = catchAsyncError(async (req, res, next) => {
  try {
    const { truckId } = req.params;
    const truckOwnerId = req.user._id;

    const truck = await Truck.findById(truckId);
    if (!truck) return next(new ErrorHandler('Truck not found', 404));

    if (!truck.truck_owner_id.equals(truckOwnerId)) {
      return next(new ErrorHandler('You do not have permission to remove this truck', 403));
    }

    await User.findByIdAndUpdate(truckOwnerId, {
      $pull: { truck_ids: truckId }
    });

    truck.truck_owner_id = null;
    await truck.save();

    res.status(200).json({
      success: true,
      message: 'Truck successfully removed from your account',
    });
  } catch (error) {
    next(error);
  }
});