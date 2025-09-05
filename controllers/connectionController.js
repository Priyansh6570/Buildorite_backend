import Connection from "../models/connectionModel.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import User from "../models/userModel.js";
import Truck from "../models/truckModel.js";

export const sendConnectionRequest = catchAsyncError(async (req, res, next) => {
  const { to_user, truck_id } = req.body;
  const from_user = req.user._id;

  const truck = await Truck.findById(truck_id);
  if (!truck || !truck.driver_id.equals(from_user)) {
    return next(new ErrorHandler("Invalid truck or you're not the driver of this truck", 400));
  }

  const existing = await Connection.findOne({ from_user, to_user });
  if (existing) return next(new ErrorHandler("Request already sent", 400));

  const connection = await Connection.create({ from_user, to_user });

  res.status(201).json({ success: true, data: connection });
});

export const getPendingConnections = catchAsyncError(async (req, res) => {
  try {
    const connections = await Connection.find({ to_user: req.user._id, status: "pending" }).populate("from_user", "name role");

    const enriched = await Promise.all(
      connections.map(async (c) => {
        const truck = await Truck.findOne({ driver_id: c.from_user._id });
        return {
          _id: c._id,
          from_user: c.from_user,
          truck: truck || null,
          createdAt: c.createdAt,
        };
      })
    );

    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export const acceptConnectionRequest = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const connection = await Connection.findById(id).populate("from_user").populate("to_user");
    if (!connection) return next(new ErrorHandler("Request not found", 404));
    if (connection.status !== "pending") return next(new ErrorHandler("Request is already processed", 400));

    connection.status = "accepted";
    await connection.save();

    const { from_user: driver, to_user: truckOwner, truck_id } = connection;

    if (!truck_id) return next(new ErrorHandler("Truck ID is missing in connection request", 400));

    await User.findByIdAndUpdate(truckOwner._id, {
      $addToSet: { truck_ids: truck_id },
    });

    await Truck.findByIdAndUpdate(truck_id, {
      truck_owner_id: truckOwner._id,
    });

    res.status(200).json({ success: true, data: connection });
  } catch (error) {
    next(error);
  }
});

export const rejectConnectionRequest = catchAsyncError(async (req, res, next) => {
  try {
    const { id } = req.params;

    const connection = await Connection.findById(id);
    if (!connection) return next(new ErrorHandler("Request not found", 404));
    if (connection.status !== "pending") return next(new ErrorHandler("Request is already processed", 400));

    connection.status = "rejected";
    await connection.save();

    res.status(200).json({ success: true, data: connection });
  } catch (error) {
    next(error);
  }
});
