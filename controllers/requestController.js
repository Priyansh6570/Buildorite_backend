import Request from '../models/requestModel.js';
import ErrorHandler from '../utils/errorHandler.js';
import Mine from '../models/mineModel.js';
import catchAsyncError from '../middleware/catchAsyncError.js';
import { createNotification } from './notificationController.js';

// Create new request (Truck Owner) -> POST /api/v1/requests
export const createRequest = catchAsyncError(async (req, res, next) => {
  console.log("Creating request with body:", req.body);
  const { mine_id, material_id, delivery_method, delivery_location, comments, selected_unit, quantity, price_confirmed } = req.body;

  if (!mine_id || !material_id || !delivery_method || !delivery_location || !selected_unit || !quantity || !price_confirmed) {
    return next(new ErrorHandler('All required fields must be provided', 400));
  }

  const request = await Request.create({
    mine_id,
    material_id,
    truck_owner_id: req.user._id,
    delivery_method,
    delivery_location,
    comments,
    selected_unit,
    quantity,
    price_confirmed,
    status: 'pending',
  });

  await Mine.findByIdAndUpdate(mine_id, { $push: { requests: request._id } });

  // notification
  const mine = await Mine.findById(mine_id).populate("owner_id");
  if (mine && mine.owner_id) {
    await createNotification({
      recipient_id: mine.owner_id._id,
      type: "request_created",
      message: `New request created by ${req.user.name} for material at ${mine.name}`,
      related_request_id: request._id,
    });
  }

  res.status(201).json({ success: true, data: request });
});

// Get all requests -> GET /api/v1/requests
export const getMyRequests = catchAsyncError(async (req, res, next) => {
  const filter = req.user.role === 'mine_owner' ? { mine_id: { $in: req.user.mine_id } } : { truck_owner_id: req.user._id };
  const requests = await Request.find(filter).populate('mine_id material_id truck_owner_id');

  res.status(200).json({ success: true, data: requests });
});

// Cancel request (Truck Owner or Mine Owner) -> PATCH /api/v1/requests/:id/cancel
export const cancelRequest = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  const request = await Request.findById(id).populate("mine_id").populate("truck_owner_id");

  if (!request) return next(new ErrorHandler('Request not found', 404));

  const isTruckOwner = req.user.role === 'truck_owner' && request.truck_owner_id._id.toString() === req.user._id.toString();
  const isMineOwner = req.user.role === 'mine_owner' && req.user.mine_id.includes(request.mine_id._id.toString());

  if (!isTruckOwner && !isMineOwner) return next(new ErrorHandler('Unauthorized to cancel this request', 403));

  request.status = 'canceled';
  request.rejection_reason = rejection_reason;
  await request.save();

  if (isTruckOwner) {
    // Notify mine owner
    await createNotification({
      recipient_id: request.mine_id.owner_id,
      type: "request_canceled",
      message: `Request from ${req.user.name} has been canceled.`,
      related_request_id: request._id,
    });
  } else if (isMineOwner) {
    // Notify truck owner
    await createNotification({
      recipient_id: request.truck_owner_id._id,
      type: "request_canceled",
      message: `Your request to ${request.mine_id.name} has been canceled by the Owner.`,
      related_request_id: request._id,
    });
  }

  res.status(200).json({ success: true, data: request });
});

// Accept request (Mine Owner) -> PATCH /api/v1/requests/:id/accept
export const acceptRequest = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { truck_id, pickup_schedule } = req.body;

  const request = await Request.findById(id).populate("truck_owner_id");

  if (!request) return next(new ErrorHandler('Request not found', 404));

  if (!req.user.mine_id.includes(request.mine_id.toString())) return next(new ErrorHandler('Unauthorized to accept this request', 403));

  request.status = 'accepted';
  if (request.delivery_method === 'delivery') request.truck_id = truck_id;
  if (pickup_schedule) request.pickup_schedule = pickup_schedule;

  await request.save();

  // Notify truck owner
  await createNotification({
    recipient_id: request.truck_owner_id._id,
    type: "request_accepted",
    message: `Your request has been accepted.`,
    related_request_id: request._id,
  });

  res.status(200).json({ success: true, data: request });
});

// Reject request (Mine Owner) -> PATCH /api/v1/requests/:id/reject
export const rejectRequest = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { cancellation_reason } = req.body;

  const request = await Request.findById(id).populate("truck_owner_id");

  if (!request) return next(new ErrorHandler('Request not found', 404));

  if (!req.user.mine_id.includes(request.mine_id.toString())) return next(new ErrorHandler('Unauthorized to reject this request', 403));

  request.status = 'rejected';
  request.cancellation_reason = cancellation_reason;

  await request.save();

  // Notify truck owner
  await createNotification({
    recipient_id: request.truck_owner_id._id,
    type: "request_rejected",
    message: `Your request has been rejected by the mine owner. Reason: ${cancellation_reason || "Not specified"}.`,
    related_request_id: request._id,
  });

  res.status(200).json({ success: true, data: request });
});

// Edit request (Mine Owner) -> PATCH /api/v1/requests/:id
export const editRequest = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const updates = req.body;

  const request = await Request.findById(id);
  if (!request) return next(new ErrorHandler('Request not found', 404));

  if (!req.user.mine_id.includes(request.mine_id.toString())) return next(new ErrorHandler('Unauthorized to edit this request', 403));

  Object.assign(request, updates);
  await request.save();

  res.status(200).json({ success: true, data: request });
});

// Get request by ID -> GET /api/v1/requests/:id
export const getRequestById = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  
  const request = await Request.findById(id)
    .populate('mine_id material_id truck_owner_id');
  
  if (!request) {
    return next(new ErrorHandler('Request not found', 404));
  }
  
  // Check if user has permission to view this request
  const isTruckOwner = req.user.role === 'truck_owner' && 
    request.truck_owner_id._id.toString() === req.user._id.toString();
  const isMineOwner = req.user.role === 'mine_owner' && 
    req.user.mine_id.includes(request.mine_id._id.toString());
  
  if (!isTruckOwner && !isMineOwner) {
    return next(new ErrorHandler('Unauthorized to view this request', 403));
  }
  
  res.status(200).json({ success: true, data: request });
});