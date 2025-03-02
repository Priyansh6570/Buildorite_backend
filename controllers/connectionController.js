import Connection from '../models/connectionModel.js';
import ErrorHandler from '../utils/errorHandler.js';
import catchAsyncError from '../middleware/catchAsyncError.js';
import User from '../models/userModel.js';
import Truck from '../models/truckModel.js';

// Send connection request -> /connection-request
export const sendConnectionRequest = catchAsyncError(async (req, res, next) => {
    try {
      const { to_user } = req.body;
      const from_user = req.user._id;
  
      const existingRequest = await Connection.findOne({ from_user, to_user });
      if (existingRequest) {
        return next(new ErrorHandler('Request already sent', 400));
      }
  
      const connection = await Connection.create({ from_user, to_user });
      res.status(201).json({ success: true, data: connection });
    } catch (error) {
      next(error);
    }
  });

// Get all pending connection requests -> /pending-connections
  export const getPendingConnections = catchAsyncError(async (req, res) => {
    try {
      const connections = await Connection.find({ to_user: req.user._id, status: 'pending' }).populate('from_user', 'name role');
      res.status(200).json({ success: true, data: connections });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  // Accept connection request -> /accept-connection/:id
  export const acceptConnectionRequest = catchAsyncError(async (req, res, next) => {
    try {
      const { id } = req.params;
  
      const connection = await Connection.findById(id).populate('from_user').populate('to_user');
      if (!connection) return next(new ErrorHandler('Request not found', 404));
      if (connection.status !== 'pending') return next(new ErrorHandler('Request is already processed', 400));
  
      connection.status = 'accepted';
      await connection.save();
  
      const { from_user: driver, to_user: truckOwner, truck_id } = connection;
  
      if (!truck_id) return next(new ErrorHandler('Truck ID is missing in connection request', 400));
  
      await User.findByIdAndUpdate(truckOwner._id, {
        $addToSet: { truck_ids: truck_id }
      });
  
      await Truck.findByIdAndUpdate(truck_id, {
        truck_owner_id: truckOwner._id
      });
  
      res.status(200).json({ success: true, data: connection });
    } catch (error) {
      next(error);
    }
  });  
  
  // Reject connection request -> /reject-connection/:id
  export const rejectConnectionRequest = catchAsyncError(async (req, res, next) => {
    try {
      const { id } = req.params;
  
      const connection = await Connection.findByIdAndUpdate(id, { status: 'rejected' }, { new: true });
      if (!connection) return next(new ErrorHandler('Request not found', 404));
  
      res.status(200).json({ success: true, data: connection });
    } catch (error) {
      next(error);
    }
  });