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
  try {
    const owner = await User.findById(req.user._id).populate({
      path: 'driver_ids',
      populate: [
        { path: 'truck_id' },
        {
          path: 'assigned_trip_id',
          populate: {
            path: 'request_id',
            select: 'finalized_agreement.schedule',
          },
        },
      ],
    });

    if (!owner) return next(new ErrorHandler('Owner not found', 404));

    const minimalDrivers = owner.driver_ids.map((d) => {
      const trip = d.assigned_trip_id?.[0];
      const schedule = trip?.request_id?.finalized_agreement?.schedule || null;

      return {
        _id: d._id,
        name: d.name,
        email: d.email,
        phone: d.phone,
        isRegistered: d.isRegistered,
        truck: {
          _id: d.truck_id?._id,
          name: d.truck_id?.name,
          reg: d.truck_id?.registration_number,
        },
        schedule,
      };
    });

    res.status(200).json({
      success: true,
      data: minimalDrivers,
    });
  } catch (error) {
    next(error);
  }
});

// get driver by id with trip details 

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

export const getDriverDetails = catchAsyncError(async (req, res, next) => {
    try {
        const { driverId } = req.params;

        if (!driverId) {
            return next(new ErrorHandler('Driver ID is required', 400));
        }
        const driverDetails = await User.findById(driverId)
            .select('name phone truck_id assigned_trip_id')
            .populate({
                path: 'truck_id',
                select: 'name registration_number',
            })
            .populate({
                path: 'assigned_trip_id',
                select: 'started_at status milestone_history destination request_id',
                populate: {
                    path: 'request_id',
                    select: 'mine_id material_id finalized_agreement.quantity',
                    populate: [
                        {
                            path: 'mine_id',
                            select: 'name location',
                        },
                        {
                            path: 'material_id',
                            select: 'name',
                        },
                    ],
                },
            })
            .lean();

        if (!driverDetails) {
            return next(new ErrorHandler('Driver not found', 404));
        }
        console.log('Driver details fetched successfully:', driverDetails);
        res.status(200).json(driverDetails);

    } catch (error) {
        console.error('Error fetching driver details:', error);
        res.status(500).json({ message: 'Server error while fetching driver details.' });
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