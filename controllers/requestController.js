import Request from "../models/requestModel.js";
import Mine from "../models/mineModel.js";
import Truck from "../models/truckModel.js";
import User from "../models/userModel.js";
import Trip from "../models/tripModel.js";
import { createTripForRequest } from "./tripController.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import { createNotification } from "./notificationController.js";

/**
 * @route   POST /api/v1/requests
 * @desc    Create a new request (Buyer/Truck Owner initiates)
 * @access  Private (Truck Owner)
 */
export const createRequest = catchAsyncError(async (req, res, next) => {
  const { mine_id, material_id, truck_id, proposal } = req.body;

  console.log(mine_id, material_id, truck_id);

  if (
    !mine_id ||
    !material_id ||
    !proposal ||
    !proposal.price ||
    !proposal.quantity ||
    !proposal.unit ||
    !proposal.delivery_method
  ) {
    return next(
      new ErrorHandler(
        "Missing required fields for the initial request proposal.",
        400
      )
    );
  }

  const truck_owner_id = req.user._id;

  const newRequest = await Request.create({
    mine_id,
    material_id,
    truck_owner_id,
    truck_id,
    status: "pending",
    last_updated_by: "buyer",
    current_proposal: proposal,
    history: [
      {
        by: "buyer",
        proposal: proposal,
        timestamp: new Date(),
      },
    ],
  });

  await Mine.findByIdAndUpdate(mine_id, {
    $push: { requests: newRequest._id },
  });

  // Find the mine owner to send a notification
  const mine = await Mine.findById(mine_id).populate("owner_id");
  if (mine && mine.owner_id) {
    await createNotification({
      recipient_id: mine.owner_id._id,
      type: "request_created",
      message: `New material request from ${req.user.name}.`,
      related_request_id: newRequest._id,
    });
  }

  res.status(201).json({
    success: true,
    message: "Request created successfully.",
    data: newRequest,
  });
});

/**
 * @route   GET /api/v1/requests
 * @desc    Get all requests for the logged-in user (both roles)
 * @access  Private
 */
export const getMyRequests = catchAsyncError(async (req, res, next) => {
  const filter =
    req.user.role === "mine_owner" || req.user.role === "admin"
      ? { mine_id: { $in: req.user.mine_id } }
      : { truck_owner_id: req.user._id };

  const requests = await Request.find(filter)
    .populate("mine_id", "name")
    .populate("material_id")
    .populate("truck_owner_id", "name")
    .populate({
      path: "current_proposal",
      populate: {
        path: "unit",
        model: "Unit",
      },
    })
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    count: requests.length,
    data: requests,
  });
});

/**
 * @route   GET /api/v1/requests/:id
 * @desc    Get a single request by its ID
 * @access  Private
 */
export const getRequestById = catchAsyncError(async (req, res, next) => {
  const request = await Request.findById(req.params.id)
    .populate("mine_id", "name owner_id location")
    .populate({
      path: "material_id",
      select: "name",
      populate: {
        path: "prices.unit",
      },
    })
    .populate("truck_owner_id", "name")
    .populate("driver_id", "name phone")
    .populate({
      path: "history.proposal",
      populate: { path: "unit" },
    })
    .populate({
      path: "current_proposal",
      populate: { path: "unit" },
    })
    .populate({
      path: "finalized_agreement",
      populate: { path: "unit" },
    });

  if (!request) {
    return next(new ErrorHandler("Request not found", 404));
  }

  const isTruckOwner =
    req.user._id.toString() === request.truck_owner_id._id.toString();
  const isMineOwner = req.user.mine_id.includes(request.mine_id._id.toString());

  if (!isTruckOwner && !isMineOwner) {
    return next(
      new ErrorHandler("You are not authorized to view this request", 403)
    );
  }

  res.status(200).json({
    success: true,
    data: request,
  });
});

/**
 * @route   PATCH /api/v1/requests/:id/proposal
 * @desc    Submit a new proposal or counter-offer
 * @access  Private
 */
export const submitProposal = catchAsyncError(async (req, res, next) => {
  const { proposal } = req.body;
  if (!proposal) {
    return next(new ErrorHandler("Proposal data is required", 400));
  }

  const request = await Request.findById(req.params.id);
  if (!request) {
    return next(new ErrorHandler("Request not found", 404));
  }

  if (
    ["accepted", "rejected", "canceled", "completed"].includes(request.status)
  ) {
    return next(
      new ErrorHandler(
        `Cannot submit a proposal for a request that is already ${request.status}`,
        400
      )
    );
  }

  let currentUserRole;
  if (
    req.user.mine_id &&
    req.user.mine_id.includes(request.mine_id.toString())
  ) {
    currentUserRole = "seller";
  } else if (req.user._id.toString() === request.truck_owner_id.toString()) {
    currentUserRole = "buyer";
  } else {
    return next(
      new ErrorHandler("You are not authorized to act on this request.", 403)
    );
  } 
  if (request.last_updated_by === currentUserRole) {
    return next(
      new ErrorHandler(
        "You cannot counter your own proposal. Wait for the other party to respond.",
        400
      )
    );
  }

  
  request.current_proposal = proposal;
  request.status = "countered";
  request.last_updated_by = currentUserRole;
  
  request.history.push({
    by: request.last_updated_by,
    proposal: request.current_proposal,
    timestamp: new Date(),
  });
  
  await request.save();

  const recipient_id =
    currentUserRole === "buyer"
      ? request.mine_id.owner_id
      : request.truck_owner_id;
  await createNotification({
    recipient_id,
    type: "proposal_updated",
    message: `You have a new proposal from ${req.user.name}.`,
    related_request_id: request._id,
  });

  res.status(200).json({
    success: true,
    message: "Proposal submitted successfully.",
    data: request,
  });
});

/**
 * @route   PATCH /api/v1/requests/:id/status
 * @desc    Accept, Reject, or Cancel a request
 * @access  Private
 */
export const updateRequestStatus = catchAsyncError(async (req, res, next) => {
  const { status, reason } = req.body;
  const validStatuses = ["accepted", "rejected", "canceled"];

  if (!status || !validStatuses.includes(status)) {
    return next(
      new ErrorHandler(
        "A valid status (accepted, rejected, canceled) is required.",
        400
      )
    );
  }

  const request = await Request.findById(req.params.id).populate(
    "mine_id",
    "owner_id"
  );
  if (!request) {
    return next(new ErrorHandler("Request not found", 404));
  }

  if (
    ["accepted", "rejected", "canceled", "completed"].includes(request.status)
  ) {
    return next(
      new ErrorHandler(
        `Request is already ${request.status} and cannot be changed.`,
        400
      )
    );
  }

 const userRole = ["mine_owner", "admin"].includes(req.user.role) ? "seller" : "buyer";
  console.log("User Role:", userRole);
  let notificationMessage = "";
  let recipient_id;

  switch (status) {
    case "accepted":
      if (request.last_updated_by === userRole) {
        return next(
          new ErrorHandler("You cannot accept your own proposal.", 400)
        );
      }
      request.finalized_agreement = request.current_proposal;
      notificationMessage = `Your request has been accepted by ${req.user.name}!`;
      break;
    case "rejected":
      request.rejection_reason = reason;
      notificationMessage = `Your request was rejected by ${req.user.name}.`;
      break;
    case "canceled":
      // Typically, only the buyer can cancel before acceptance.
      if (userRole !== "buyer") {
        return next(
          new ErrorHandler("Only the truck owner can cancel the request.", 403)
        );
      }
      request.cancellation_reason = reason;
      notificationMessage = `A request was canceled by ${req.user.name}.`;
      break;
  }

  request.status = status;
  request.last_updated_by = userRole;
  await request.save();

  // Notify the other party
  recipient_id =
    userRole === "buyer" ? request.mine_id.owner_id : request.truck_owner_id;
  await createNotification({
    recipient_id,
    type: `request_${status}`,
    message: notificationMessage,
    related_request_id: request._id,
  });

  res.status(200).json({
    success: true,
    message: `Request has been successfully ${status}.`,
    data: request,
  });
});

/**
 * @route   PATCH /api/v1/requests/:id/assign-driver
 * @desc    Assign a driver to an accepted request
 * @access  Private
 */
export const assignDriver = catchAsyncError(async (req, res, next) => {
    const { driver_id: newDriverId } = req.body;
    if (!newDriverId) {
        return next(new ErrorHandler("Driver ID is required.", 400));
    }

    const request = await Request.findById(req.params.id);
    if (!request) {
        return next(new ErrorHandler("Request not found.", 404));
    }

    // Allow assignment only if the request is 'accepted' or already 'in_progress' (for re-assignment)
    if (request.status !== "accepted" && request.status !== "in_progress") {
        return next(
            new ErrorHandler(
                `Cannot assign driver. Request status is '${request.status}'`,
                400
            )
        );
    }

    // --- Authorization Checks ---
    const { delivery_method } = request.finalized_agreement;
    const isMineOwner = req.user.mine_id.includes(request.mine_id.toString());
    const isTruckOwner = req.user._id.toString() === request.truck_owner_id.toString();

    if (delivery_method === "delivery" && !isMineOwner) {
        return next(new ErrorHandler("Only the mine owner can assign a driver for delivery.", 403));
    }
    if (delivery_method === "pickup" && !isTruckOwner) {
        return next(new ErrorHandler("Only the truck owner can assign a driver for pickup.", 403));
    }

    const oldDriverId = request.driver_id;

    // Prevent re-assigning the same driver
    if (oldDriverId && oldDriverId.toString() === newDriverId.toString()) {
        return next(new ErrorHandler("This driver is already assigned to the request.", 400));
    }

    // --- Main Logic for Assignment/Re-assignment ---
    try {
        // If a driver was already assigned, handle the cleanup of the old trip
        if (oldDriverId) {
            console.log(`Re-assigning driver. Old driver ID: ${oldDriverId}`);
            const oldTrip = await Trip.findOne({ request_id: request._id, driver_id: oldDriverId, status: 'active' });
            
            if (oldTrip) {
                oldTrip.status = 'canceled';
                oldTrip.cancel_reason = 'Driver was re-assigned by the owner.';
                await oldTrip.save();

                // Free up the old driver's truck
                const oldDriver = await User.findById(oldDriverId);
                if (oldDriver && oldDriver.truck_id) {
                    await Truck.findByIdAndUpdate(oldDriver.truck_id, { status: 'idle', $unset: { assigned_trip_id: 1 } });
                }
                // Remove the old trip from the driver's assignments
                await User.findByIdAndUpdate(oldDriverId, { $pull: { assigned_trip_id: oldTrip._id } });
            }
        }

        // Assign the new driver and update the request status
        request.driver_id = newDriverId;
        request.status = "in_progress";
        await request.save();

        // Create the new trip for the new driver
        await createTripForRequest(request._id, newDriverId);

        // Send a final confirmation notification
        const recipient_id = isMineOwner ? request.truck_owner_id : request.mine_id.owner_id;
        await createNotification({
            recipient_id,
            type: "driver_assigned",
            message: `A driver has been assigned for your order by ${req.user.name}. The trip is now in progress.`,
            related_request_id: request._id,
        });

        res.status(200).json({
            success: true,
            message: "Driver assigned and trip created successfully. Status updated to in-progress.",
            data: request,
        });

    } catch (error) {
        console.error("Error during driver assignment and trip creation:", error);
        
        // Rollback: Revert the request to its pre-assignment state
        request.driver_id = oldDriverId || undefined; // Revert to old driver if one existed
        request.status = "accepted"; // Always revert to 'accepted'
        await request.save();
        
        return next(new ErrorHandler(`Failed to assign new driver: ${error.message}`, 500));
    }
});

/**
 * @route   PATCH /api/v1/requests/:id/complete
 * @desc    Mark a request as completed
 * @access  Private
 */
export const markAsCompleted = catchAsyncError(async (req, res, next) => {
  const request = await Request.findById(req.params.id);
  if (!request) {
    return next(new ErrorHandler("Request not found.", 404));
  }

  if (request.status !== "in_progress") {
    return next(
      new ErrorHandler(
        `Cannot complete a request that is not in-progress. Current status: ${request.status}`,
        400
      )
    );
  }

  const isMineOwner = req.user.mine_id.includes(request.mine_id.toString());
  const isTruckOwner =
    req.user._id.toString() === request.truck_owner_id.toString();
  if (!isMineOwner && !isTruckOwner) {
    return next(
      new ErrorHandler("You are not authorized to update this request.", 403)
    );
  }

  request.status = "completed";
  await request.save();

  res.status(200).json({
    success: true,
    message: "Request marked as completed.",
    data: request,
  });
});
