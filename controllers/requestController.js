import Request from "../models/requestModel.js";
import Mine from "../models/mineModel.js";
import Material from "../models/materialModel.js"
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
        proposal,
        timestamp: new Date(),
      },
    ],
  });

  await Mine.findByIdAndUpdate(mine_id, {
    $push: { requests: newRequest._id },
  });

  await Material.findByIdAndUpdate(material_id, {
    $inc: { orders_count: 1 },
  });

  // 👉 notify mine owner with material name
  const mine = await Mine.findById(mine_id).select("owner_id name");
  const material = await Material.findById(material_id).select("name");

  if (mine?.owner_id && material) {
    await createNotification({
      recipient_id: mine.owner_id,
      type: "mine_request_created",
      title: "New Material Request",
      message: `You received a new request for ${material.name}.`,
      payload: {
        requestId: newRequest._id.toString(),
      },
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

// get count of all requests
/**
 * @route   GET /api/v1/requests/count
 * @desc    Get count of all requests
 * @access  Private
 */
export const getRequestCount = catchAsyncError(async (req, res, next) => {
  const count = await Request.countDocuments();
  res.status(200).json({
    success: true,
    count,
  });
});

/**
 * @route   GET /api/v1/requests/:id
 * @desc    Get a single request by its ID
 * @access  Private
 */
export const getRequestById = catchAsyncError(async (req, res, next) => {
  const request = await Request.findById(req.params.id)
     .populate({
    path: "mine_id",
    select: "name location owner_id",
    populate: {
      path: "owner_id",
      select: "name phone",
    },
  })
    .populate({
      path: "material_id",
      select: "name",
      populate: {
        path: "prices.unit",
      },
    })
    .populate("truck_owner_id", "name phone")
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

  const request = await Request.findById(req.params.id)
    .populate("mine_id", "owner_id name")
    .populate("material_id", "name");
  if (!request) {
    return next(new ErrorHandler("Request not found", 404));
  }

  if (["accepted", "rejected", "canceled", "completed"].includes(request.status)) {
    return next(new ErrorHandler(
      `Cannot submit a proposal for a request that is already ${request.status}`, 400
    ));
  }

  let currentUserRole;
  if (req.user.mine_id && req.user.mine_id.includes(request.mine_id._id.toString())) {
    currentUserRole = "seller";
  } else if (req.user._id.toString() === request.truck_owner_id.toString()) {
    currentUserRole = "buyer";
  } else {
    return next(new ErrorHandler("You are not authorized to act on this request.", 403));
  }

  if (request.last_updated_by === currentUserRole) {
    return next(new ErrorHandler("You cannot counter your own proposal. Wait for the other party to respond.", 400));
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

  // ✅ Correct recipient selection
  const recipient_id = currentUserRole === "buyer"
    ? request.mine_id.owner_id
    : request.truck_owner_id;

  await createNotification({
    recipient_id,
    type: "request_countered",
    title: `New Proposal from ${req.user.name}`,
    message: `Counter Proposal for ${request.material_id.name} from ${req.user.name}`,
    payload: {
      requestId: request._id.toString(),
    },
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

  const request = await Request.findById(req.params.id)
    .populate("mine_id", "owner_id")
    .populate("material_id", "name");
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

  const userRole = ["mine_owner", "admin"].includes(req.user.role)
    ? "seller"
    : "buyer";

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
      notificationMessage = `Your request for ${request.material_id.name} has been accepted by ${req.user.name}!`;
      // recipient = opposite party
      recipient_id =
        userRole === "seller"
          ? request.truck_owner_id
          : request.mine_id.owner_id;
      break;

    case "rejected":
      request.rejection_reason = reason;
      notificationMessage = `Your request for ${request.material_id.name} was rejected by ${req.user.name}.`;
      recipient_id =
        userRole === "seller"
          ? request.truck_owner_id
          : request.mine_id.owner_id;
      break;

    case "canceled":
      if (userRole !== "buyer") {
        return next(
          new ErrorHandler("Only the truck owner can cancel the request.", 403)
        );
      }
      request.cancellation_reason = reason;
      notificationMessage = `The request for ${request.material_id.name} was canceled by ${req.user.name}.`;
      recipient_id = request.mine_id.owner_id;
      break;
  }

  request.status = status;
  request.last_updated_by = userRole;
  await request.save();

  // update related trips if rejected/canceled
  if (["rejected", "canceled"].includes(status) && request.trip_id) {
    const reasonMsg =
      status === "rejected"
        ? `Truck owner (${req.user.name}) rejected the request: ${
            reason || "no reason"
          }`
        : `Mine owner (${req.user.name}) canceled the request: ${
            reason || "no reason"
          }`;

    await Trip.updateMany(
      { request_id: request._id },
      {
        $set: {
          status: "canceled",
          cancel_reason: reasonMsg,
          completed_at: new Date(),
        },
        $push: {
          milestone_history: {
            status: "canceled",
            timestamp: new Date(),
            location: undefined,
          },
        },
      }
    );
  }

  // 👉 send notification if recipient determined
  if (recipient_id) {
    await createNotification({
      recipient_id,
      type: `request_${status}`,
      title: `Request ${status}`,
      message: notificationMessage,
      payload: {
        requestId: request._id.toString(),
      },
    });
  }

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

  const request = await Request.findById(req.params.id)
    .populate("mine_id", "owner_id")
    .populate("material_id", "name");
  if (!request) {
    return next(new ErrorHandler("Request not found", 404));
  }

  if (request.status !== "accepted" && request.status !== "in_progress") {
    return next(
      new ErrorHandler(
        `Cannot assign driver. Request status is '${request.status}'`,
        400
      )
    );
  }

  const { delivery_method } = request.finalized_agreement;
  let isMineOwner = req.user.mine_id.includes(request.mine_id.toString());
  // if admin then isMineOwner = true
  isMineOwner = req.user.role === "admin" || isMineOwner;
  const isTruckOwner =
    req.user._id.toString() === request.truck_owner_id.toString();

  if (delivery_method === "delivery" && !isMineOwner) {
    return next(
      new ErrorHandler(
        "Only the mine owner can assign a driver for delivery.",
        403
      )
    );
  }
  if (delivery_method === "pickup" && !isTruckOwner) {
    return next(
      new ErrorHandler(
        "Only the truck owner can assign a driver for pickup.",
        403
      )
    );
  }

  const oldDriverId = request.driver_id;

  if (oldDriverId && oldDriverId.toString() === newDriverId.toString()) {
    return next(
      new ErrorHandler("This driver is already assigned to the request.", 400)
    );
  }

  try {
    if (oldDriverId) {
      // 🔄 Re-assignment branch
      console.log(`Re-assigning driver. Old driver ID: ${oldDriverId}`);
      const oldTrip = await Trip.findOne({
        request_id: request._id,
        driver_id: oldDriverId,
        status: "active",
      });

      if (oldTrip) {
        oldTrip.status = "canceled";
        oldTrip.cancel_reason = "Driver was re-assigned by the owner.";
        await oldTrip.save();

        // Free up old driver's truck
        const oldDriver = await User.findById(oldDriverId);
        if (oldDriver && oldDriver.truck_id) {
          await Truck.findByIdAndUpdate(oldDriver.truck_id, {
            status: "idle",
            $unset: { assigned_trip_id: 1 },
          });
        }
        await User.findByIdAndUpdate(oldDriverId, {
          $pull: { assigned_trip_id: oldTrip._id },
        });

        // 👉 notify old driver that he has been relieved
        await createNotification({
          recipient_id: oldDriverId,
          type: "driver_unassigned",
          title: "You’ve been unassigned",
          message: `You have been unassigned from request for ${request.material_id.name}.`,
          payload: {
            requestId: request._id.toString(),
            tripId: oldTrip._id.toString(),
          },
        });
      }
    }

    // assign new driver
    request.driver_id = newDriverId;
    request.status = "in_progress";
    await request.save();

    const t_id = await createTripForRequest(request._id, newDriverId);
    request.trip_id = t_id._id;
    await request.save();

    // 👉 notify the other party
    const recipient_id = isMineOwner
      ? request.truck_owner_id
      : request.mine_id.owner_id;

    await createNotification({
      recipient_id,
      type: oldDriverId ? "driver_reassigned" : "driver_assigned",
      title: oldDriverId
        ? "Driver Re-assigned"
        : "Driver Assigned",
      message: oldDriverId
        ? `A new driver has been assigned for ${request.material_id.name}.`
        : `Driver assigned for ${request.material_id.name}. Trip is in progress.`,
      payload: {
        requestId: request._id.toString(),
        tripId: t_id._id.toString(),
      },
    });

    res.status(200).json({
      success: true,
      message:
        "Driver assigned and trip created successfully. Status updated to in-progress.",
      data: request,
    });
  } catch (error) {
    console.error("Error during driver assignment and trip creation:", error);
    request.driver_id = oldDriverId || undefined;
    request.status = "accepted";
    await request.save();

    return next(
      new ErrorHandler(`Failed to assign new driver: ${error.message}`, 500)
    );
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
