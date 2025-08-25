import Trip from "../models/tripModel.js";
import Request from "../models/requestModel.js";
import Truck from "../models/truckModel.js";
import Mine from "../models/mineModel.js";
import Material from "../models/materialModel.js";
import User from "../models/userModel.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { createNotification } from "./notificationController.js";

export const createTripForRequest = async (requestId, driverId) => {
  const request = await Request.findById(requestId)
    .populate("mine_id", "location name")
    .populate("material_id", "name");

  if (!request || request.status !== "in_progress") {
    throw new Error("Trip can only be created for an in-progress request.");
  }

  const driver = await User.findById(driverId);
  if (!driver || !driver.truck_id) {
    throw new Error("Selected driver is not valid or has no truck assigned.");
  }

  let destination = request.finalized_agreement.delivery_location;
  if (!destination || !destination.coordinates || !destination.address) {
    throw new Error("Destination location for the trip could not be determined.");
  }

  const trip = await Trip.create({
    request_id: requestId,
    truck_id: driver.truck_id,
    driver_id: driverId,
    mine_id: request.mine_id._id,
    destination,
    trip_type: request.finalized_agreement.delivery_method,
    milestone_history: [{ status: "trip_assigned" }],
  });

  await Truck.findByIdAndUpdate(driver.truck_id, {
    status: "on_trip",
    assigned_trip_id: trip._id,
  });
  await User.findByIdAndUpdate(driverId, {
    $push: { assigned_trip_id: trip._id },
  });

  // 👉 notify the driver
  await createNotification({
    recipient_id: driverId,
    type: "driver_trip_assigned",
    title: "New Trip Assigned",
    message: `You have been assigned a new trip for ${request.material_id.name}.`,
    payload: {
      tripId: trip._id.toString()
    },
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

  if (role === "driver") {
    query = { driver_id: _id };
  } else if (role === "truck_owner") {
    const userWithTrucks = await User.findById(_id).populate("driver_ids");
    const truckIds = userWithTrucks.driver_ids.map((d) => d.truck_id);
    query = { truck_id: { $in: truckIds } };
  } else if (role === "mine_owner") {
    query = { mine_id: { $in: mine_id } };
  }

  console.log(`Querying trips with criteria: ${JSON.stringify(query)}`);

  const trips = await Trip.find(query)
    .populate({
      path: "request_id",
      select: "material_id finalized_agreement",
      populate: { path: "material_id", select: "name" },
    })
    .populate("truck_id", "name registration_number")
    .populate("driver_id", "name")
    .sort({ started_at: -1 });

  res.status(200).json({ success: true, count: trips.length, data: trips });
});

// Mine Owner Analytics
export const getMineOwnerAnalytics = catchAsyncError(async (req, res, next) => {
  const sRaw = req.body?.startDate ?? req.query?.startDate;
  const eRaw = req.body?.endDate ?? req.query?.endDate;
  const start = sRaw ? new Date(sRaw) : new Date("2025-01-01");
  const end = eRaw ? new Date(eRaw) : new Date();
  if (eRaw) end.setHours(23, 59, 59, 999);

  try {
    const mineIds = await Mine.find({ owner_id: req.user._id }).distinct("_id");

    const reqs = await Request.find({ mine_id: { $in: mineIds } })
      .select("delivery_method material_id mine_id status")
      .populate("material_id mine_id")
      .lean();

    const trips = await Trip.find({
      mine_id: { $in: mineIds },
      started_at: { $gte: start, $lte: end },
    })
      .populate({
        path: "request_id",
        populate: [
          { path: "material_id", select: "name" },
          { path: "mine_id", select: "name" },
        ],
      })
      .lean();

      const requestStatusCounts = reqs.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});


    const deliveryMethodBreakdown = {
      pickup: { count: 0, materials: {} },
      delivery: { count: 0, materials: {} },
    };

    trips.forEach((t) => {
      const method = t.request_id?.finalized_agreement?.delivery_method;
      const matName = t.request_id?.material_id?.name;
      const mineName = t.request_id?.mine_id?.name;

      if (!method || !matName) return;

      deliveryMethodBreakdown[method].count++;

      if (!deliveryMethodBreakdown[method].materials[matName]) {
        deliveryMethodBreakdown[method].materials[matName] = { count: 0, mine: mineName };
      }
      deliveryMethodBreakdown[method].materials[matName].count++;
    });

    const ordersByMonth = trips.reduce((a, t) => {
      if (!t.started_at) return a;
      const k = t.started_at.toISOString().slice(0, 7);
      a[k] = (a[k] || 0) + 1;
      return a;
    }, {});
    const revenueByMonth = {};
    const revenueBreakdown = {
      materialRevenue: {},
      mineRevenue: {},
      totalRevenue: 0,
      totalPriceRevenue: 0,
      totalDeliveryRevenue: 0,
    };

    trips.forEach((t) => {
      const ag = t.request_id?.finalized_agreement;
      if (!t.started_at || !ag) return;

      const monthKey = t.started_at.toISOString().slice(0, 7);

      const priceRevenue = (ag.quantity || 0) * (ag.price || 0);
      const deliveryRevenue = ag.delivery_charge || 0;
      const total = priceRevenue + deliveryRevenue;

      // Monthly totals
      if (!revenueByMonth[monthKey]) {
        revenueByMonth[monthKey] = { total: 0, price: 0, delivery: 0 };
      }
      revenueByMonth[monthKey].total += total;
      revenueByMonth[monthKey].price += priceRevenue;
      revenueByMonth[monthKey].delivery += deliveryRevenue;

      // Material revenue
      const matName = t.request_id?.material_id?.name || "Unknown";
      if (!revenueBreakdown.materialRevenue[matName]) {
        revenueBreakdown.materialRevenue[matName] = { total: 0, price: 0, delivery: 0 };
      }
      revenueBreakdown.materialRevenue[matName].total += total;
      revenueBreakdown.materialRevenue[matName].price += priceRevenue;
      revenueBreakdown.materialRevenue[matName].delivery += deliveryRevenue;

      // Mine revenue
      const mineName = t.request_id?.mine_id?.name || "Unknown";
      if (!revenueBreakdown.mineRevenue[mineName]) {
        revenueBreakdown.mineRevenue[mineName] = { total: 0, price: 0, delivery: 0 };
      }
      revenueBreakdown.mineRevenue[mineName].total += total;
      revenueBreakdown.mineRevenue[mineName].price += priceRevenue;
      revenueBreakdown.mineRevenue[mineName].delivery += deliveryRevenue;

      // Totals
      revenueBreakdown.totalRevenue += total;
      revenueBreakdown.totalPriceRevenue += priceRevenue;
      revenueBreakdown.totalDeliveryRevenue += deliveryRevenue;
    });

    const matCounts = {};
    for (const r of reqs) {
      if (!r.material_id) continue;
      const id = String(r.material_id._id);
      if (!matCounts[id]) matCounts[id] = { count: 0, name: r.material_id.name, mine: r.mine_id?.name };
      matCounts[id].count++;
    }
    const topMaterials = Object.values(matCounts)
      .sort((x, y) => y.count - x.count)
      .slice(0, 5);

    const totalOrders = reqs.length;
    const completedOrders = reqs.filter((r) => r.status === "completed").length;
    const completionRate = totalOrders ? Number(((completedOrders / totalOrders) * 100).toFixed(2)) : 0;

    const steps = ["trip_assigned", "trip_started", "arrived_at_pickup", "loading_complete", "pickup_verified", "en_route_to_delivery", "arrived_at_delivery", "delivery_complete", "delivery_verified"];
    const md = {};
    const full = [];
    for (const t of trips) {
      const mp = {};
      for (const m of t.milestone_history || []) mp[m.status] = m.timestamp ? new Date(m.timestamp) : null;
      for (let i = 0; i < steps.length - 1; i++) {
        const a = mp[steps[i]],
          b = mp[steps[i + 1]];
        if (a && b) {
          const key = `${steps[i]}→${steps[i + 1]}`;
          const d = b - a;
          if (!md[key]) md[key] = { total: 0, count: 0 };
          md[key].total += d;
          md[key].count += 1;
        }
      }
      const ta = mp["trip_assigned"],
        tb = mp["delivery_verified"];
      if (ta && tb) full.push(tb - ta);
    }
    const milestoneAverages = {};
    for (const k in md) milestoneAverages[k] = +(md[k].total / md[k].count / 3600000).toFixed(2);
    const avgTripDurationHours = full.length ? +(full.reduce((p, c) => p + c, 0) / full.length / 3600000).toFixed(2) : 0;

    // --- Operational Efficiency ---
const avgLoadingTimeHrs = milestoneAverages["arrived_at_pickup→loading_complete"] || 0;
const avgDeliveryTravelTimeHrs = milestoneAverages["en_route_to_delivery→arrived_at_delivery"] || 0;

let delayedTripsCount = 0;
let onTimeTripsCount = 0;
let scheduledTripsCount = 0;

trips.forEach(t => {
  const scheduledDate = t.request_id?.finalized_agreement?.schedule?.date
    ? new Date(t.request_id.finalized_agreement.schedule.date)
    : null;
  const deliveredDate = t.milestone_history?.find(m => m.status === "delivery_verified")?.timestamp;

  if (scheduledDate && deliveredDate) {
    scheduledTripsCount++;
    if (deliveredDate > scheduledDate) delayedTripsCount++;
    else onTimeTripsCount++;
  }
});

const onTimeRate = scheduledTripsCount
  ? Number(((onTimeTripsCount / scheduledTripsCount) * 100).toFixed(2))
  : 0;

// --- Seasonal & Time Trends ---
const months = Object.keys(ordersByMonth).sort();
const peakMonth = months.reduce((max, month) => {
  return ordersByMonth[month] > (ordersByMonth[max] || 0) ? month : max;
}, months[0] || null);

let growthRatePercent = 0;
if (months.length >= 2) {
  const lastMonthOrders = ordersByMonth[months[months.length - 2]] || 0;
  const currentMonthOrders = ordersByMonth[months[months.length - 1]] || 0;
  if (lastMonthOrders > 0) {
    growthRatePercent = Number((((currentMonthOrders - lastMonthOrders) / lastMonthOrders) * 100).toFixed(2));
  }
}

// Delivery share change
let deliveryShareChangePercent = 0;
if (months.length >= 2) {
  const getShare = (monthIndex) => {
    const month = months[monthIndex];
    const monthTrips = trips.filter(t => t.started_at?.toISOString().slice(0, 7) === month);
    const deliveryCount = monthTrips.filter(t => t.request_id?.delivery_method === "delivery").length;
    return monthTrips.length ? (deliveryCount / monthTrips.length) * 100 : 0;
  };
  const prevShare = getShare(months.length - 2);
  const currShare = getShare(months.length - 1);
  deliveryShareChangePercent = Number((currShare - prevShare).toFixed(2));
}

// --- Add to your return payload ---
return res.status(200).json({
  success: true,
  ordersByMonth,
  revenueByMonth,
  revenueBreakdown,
  topMaterials,
  completionRate,
  avgTripDurationHours,
  milestoneAverages,
  deliveryMethodBreakdown,
  efficiencyMetrics: {
    avgLoadingTimeHrs,
    avgDeliveryTravelTimeHrs,
    delayedTripsCount,
    onTimeRate
  },
  seasonalTrends: {
    peakMonth,
    growthRatePercent,
    deliveryShareChangePercent
  },
  requestStatusCounts
});
  } catch (error) {
    console.error("Error fetching mine owner analytics:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Truck Owner Analytics
export const getTruckOwnerAnalytics = catchAsyncError(async (req, res, next) => {
  // 1. Setup Date Range
  const sRaw = req.body?.startDate ?? req.query?.startDate;
  const eRaw = req.body?.endDate ?? req.query?.endDate;
  const start = sRaw ? new Date(sRaw) : new Date("2025-01-01");
  const end = eRaw ? new Date(eRaw) : new Date();
  if (eRaw) end.setHours(23, 59, 59, 999);

  try {
    // 2. Fetch Core Data
    const requests = await Request.find({
      truck_owner_id: req.user._id,
      createdAt: { $gte: start, $lte: end },
    })
      .select("status finalized_agreement material_id mine_id createdAt")
      .populate("material_id", "name")
      .populate("mine_id", "name")
      .lean();

    const requestIds = requests.map((r) => r._id);

    const trips = await Trip.find({
      request_id: { $in: requestIds },
    })
      .populate({
        path: "request_id",
        populate: [
          { path: "material_id", select: "name" },
          { path: "mine_id", select: "name" },
          // FIX #1: Corrected the populate path for the nested 'unit' field.
          { path: "finalized_agreement.unit", select: "name" },
        ],
      })
      .lean();

    // 3. Process Analytics Data

    // A. Procurement & Spending Metrics
    const spendByMonth = {};
    const spendBreakdown = {
      totalSpend: 0,
      materialSpend: 0,
      deliverySpend: 0,
    };
    const totalQuantityBreakdown = {};

    trips.forEach((trip) => {
      const ag = trip.request_id?.finalized_agreement;
      if (!trip.started_at || !ag) return;

      const monthKey = trip.started_at.toISOString().slice(0, 7);
      const materialCost = (ag.quantity || 0) * (ag.price || 0);
      const deliveryCost = ag.delivery_charge || 0;
      const totalCost = materialCost + deliveryCost;

      // Monthly spend
      if (!spendByMonth[monthKey]) {
        spendByMonth[monthKey] = { total: 0, material: 0, delivery: 0 };
      }
      spendByMonth[monthKey].total += totalCost;
      spendByMonth[monthKey].material += materialCost;
      spendByMonth[monthKey].delivery += deliveryCost;

      // Overall spend totals
      spendBreakdown.totalSpend += totalCost;
      spendBreakdown.materialSpend += materialCost;
      spendBreakdown.deliverySpend += deliveryCost;

      // Total quantity by unit
      // FIX #2: Corrected the access path for the populated unit's name.
      const unitName = trip.request_id?.finalized_agreement?.unit?.name || "Units";
      if (!totalQuantityBreakdown[unitName]) {
        totalQuantityBreakdown[unitName] = 0;
      }
      totalQuantityBreakdown[unitName] += ag.quantity || 0;
    });

    // B. Order & Trip Volume
    const ordersByMonth = requests.reduce((acc, req) => {
      const monthKey = req.createdAt.toISOString().slice(0, 7);
      acc[monthKey] = (acc[monthKey] || 0) + 1;
      return acc;
    }, {});

    const requestStatusCounts = requests.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    // C. Top Suppliers and Materials
    const materialCounts = {};
    const mineCounts = {};
    requests.forEach((req) => {
      if (req.material_id) {
        const matName = req.material_id.name || "Unknown Material";
        materialCounts[matName] = (materialCounts[matName] || 0) + 1;
      }
      if (req.mine_id) {
        const mineName = req.mine_id.name || "Unknown Mine";
        mineCounts[mineName] = (mineCounts[mineName] || 0) + 1;
      }
    });

    const topProcuredMaterials = Object.entries(materialCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const topSuppliers = Object.entries(mineCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // D. Delivery Method Breakdown
    const deliveryMethodBreakdown = requests.reduce(
      (acc, req) => {
        if (req.finalized_agreement) {
          const method = req.finalized_agreement.delivery_method;
          acc[method] = (acc[method] || 0) + 1;
        }
        return acc;
      },
      { pickup: 0, delivery: 0 }
    );

    // E. Logistics & Fleet Efficiency
    const steps = ["trip_assigned", "trip_started", "arrived_at_pickup", "loading_complete", "pickup_verified", "en_route_to_delivery", "arrived_at_delivery", "delivery_complete", "delivery_verified"];
    const milestoneDurations = {};
    const fullTripDurations = [];

    for (const t of trips) {
      const timestamps = {};
      for (const m of t.milestone_history || []) timestamps[m.status] = m.timestamp ? new Date(m.timestamp) : null;

      for (let i = 0; i < steps.length - 1; i++) {
        const startStep = timestamps[steps[i]],
          endStep = timestamps[steps[i + 1]];
        if (startStep && endStep) {
          const key = `${steps[i]}→${steps[i + 1]}`;
          const duration = endStep - startStep;
          if (!milestoneDurations[key]) milestoneDurations[key] = { total: 0, count: 0 };
          milestoneDurations[key].total += duration;
          milestoneDurations[key].count++;
        }
      }
      const tripStart = timestamps["trip_assigned"],
        tripEnd = timestamps["delivery_verified"];
      if (tripStart && tripEnd) fullTripDurations.push(tripEnd - tripStart);
    }

    const milestoneAverages = {};
    for (const k in milestoneDurations) milestoneAverages[k] = +(milestoneDurations[k].total / milestoneDurations[k].count / 3600000).toFixed(2);

    const avgTripDurationHours = fullTripDurations.length ? +(fullTripDurations.reduce((p, c) => p + c, 0) / fullTripDurations.length / 3600000).toFixed(2) : 0;

    let delayedTripsCount = 0,
      onTimeTripsCount = 0,
      scheduledTripsCount = 0;
    trips.forEach((t) => {
      const scheduledDate = t.request_id?.finalized_agreement?.schedule?.date ? new Date(t.request_id.finalized_agreement.schedule.date) : null;
      const deliveredDate = t.milestone_history?.find((m) => m.status === "delivery_verified")?.timestamp;
      if (scheduledDate && deliveredDate) {
        scheduledTripsCount++;
        if (new Date(deliveredDate) > scheduledDate) delayedTripsCount++;
        else onTimeTripsCount++;
      }
    });

    const onTimeRate = scheduledTripsCount ? Number(((onTimeTripsCount / scheduledTripsCount) * 100).toFixed(2)) : 100;

    // 4. Send Response
    return res.status(200).json({
      success: true,
      spendByMonth,
      ordersByMonth,
      spendBreakdown,
      totalQuantityBreakdown,
      deliveryMethodBreakdown,
      topProcuredMaterials,
      topSuppliers,
      logisticsEfficiency: {
        avgTripDurationHours,
        milestoneAverages,
        onTimeRate,
        delayedTripsCount,
        totalTrips: trips.length,
      },
      requestStatusCounts,
    });
  } catch (error) {
    console.error("Error fetching truck owner analytics:", error);
    // Use the next middleware for error handling
    next(error);
  }
});

// Get Count of current user's active trips and completed trips using trip status
export const getUserTripCounts = catchAsyncError(async (req, res, next) => {
  const uid = req.user._id;

  const activeTripsCount = await Trip.countDocuments({
    driver_id: uid,
    status: { $in: ["active", "issue_reported"] }
  });

  const completedTripsCount = await Trip.countDocuments({
    driver_id: uid,
    status: "completed"
  });

  res.status(200).json({
    success: true,
    data: {
      activeTripsCount,
      completedTripsCount
    }
  });
});


/**
 * @route   GET /api/v1/trips/:id
 * @desc    Get a single trip by its ID with full details
 * @access  Private
 */
export const getTripById = catchAsyncError(async (req, res, next) => {
  const trip = await Trip.findById(req.params.id)
    .populate({
      path: "request_id",
      populate: [
        { path: "material_id", select: "name" },
        { 
          path: "mine_id", 
          select: "name location",
          populate: { path: "owner_id", select: "name phone" } 
        },
        { path: "truck_owner_id", select: "name phone" },
        { path: "finalized_agreement.unit", select: "name" },
      ],
    })
    .populate("truck_id", "name registration_number")
    .populate("driver_id", "name phone");

  if (!trip) {
    return next(new ErrorHandler("Trip not found", 404));
  }
  res.status(200).json({ success: true, data: trip });
});

/**
 * @route   PATCH /api/v1/trips/:id/milestone
 * @desc    Update a trip milestone (for Drivers)
 * @access  Private (Driver)
 */
export const updateMilestone = catchAsyncError(async (req, res, next) => {
  const { status, location } = req.body;

const trip = await Trip.findById(req.params.id)
  .populate("request_id", "material_id truck_owner_id mine_id")
  .populate({
    path: "request_id",
    populate: [
      { path: "mine_id", select: "owner_id" },
      { path: "material_id", select: "name" },
    ],
  });


  if (!trip) return next(new ErrorHandler("Trip not found", 404));

  if (trip.driver_id.toString() !== req.user._id.toString()) {
    return next(
      new ErrorHandler("You are not authorized to update this trip.", 403)
    );
  }

  const newMilestone = { status, timestamp: new Date() };
  if (location) {
    newMilestone.location = {
      type: "Point",
      coordinates: location.coordinates,
    };
  }

  trip.milestone_history.push(newMilestone);

  if (status === "delivery_complete") {
    trip.completed_at = new Date();
  }

  await trip.save();

  // 👉 map status to human-readable text
  const statusMessages = {
    trip_assigned: "Driver assigned to trip",
    trip_started: "Trip started",
    arrived_at_pickup: "Arrived at pickup location",
    loading_complete: "Loading completed",
    en_route_to_delivery: "Truck en route to delivery",
    arrived_at_delivery: "Arrived at delivery location",
    delivery_complete: "Delivery completed",
  };

  const readableStatus = statusMessages[status] || status;

  // 👉 Notify mine & truck owners
  const materialName = trip.request_id.material_id.name;
  const mineOwnerId = trip.request_id.mine_id.owner_id;
  const truckOwnerId = trip.request_id.truck_owner_id;

  const msg = `${readableStatus} for ${materialName}`;

  const payload = {
    tripId: trip._id.toString(),
    requestId: trip.request_id._id.toString(),
  };

  if (mineOwnerId) {
    await createNotification({
      recipient_id: mineOwnerId,
      type: "mine_trip_milestone",
      title: "Trip Update",
      message: msg,
      payload,
    });
  }

  if (truckOwnerId) {
    await createNotification({
      recipient_id: truckOwnerId,
      type: "truck_trip_milestone",
      title: "Trip Update",
      message: msg,
      payload,
    });
  }

  res.status(200).json({ success: true, data: trip });
});

/**
 * @route   PATCH /api/v1/trips/:id/verify
 * @desc    Verify a milestone (for Mine/Truck Owners)
 * @access  Private (Mine Owner, Truck Owner)
 */
export const verifyMilestone = catchAsyncError(async (req, res, next) => {
  const { status } = req.body; // 'pickup_verified' or 'delivery_verified'

  const trip = await Trip.findById(req.params.id)
    .populate("request_id", "truck_owner_id material_id")
    .populate({ path: "request_id", populate: { path: "material_id", select: "name" } });

  if (!trip) return next(new ErrorHandler("Trip not found", 404));

  const isMineOwner = req.user.mine_id.includes(trip.mine_id.toString());
  const isTruckOwner = req.user._id.toString() === trip.request_id.truck_owner_id.toString();

  let canVerify = false;
  if (status === "pickup_verified" && isMineOwner) canVerify = true;
  if (status === "delivery_verified" && isTruckOwner) canVerify = true;

  if (!canVerify) {
    return next(new ErrorHandler("You are not authorized to verify this milestone.", 403));
  }

  trip.milestone_history.push({ status, timestamp: new Date() });

  // ✅ human-readable status text
  const statusMessages = {
    pickup_verified: "Pickup verified",
    delivery_verified: "Delivery verified - Trip completed",
  };
  const readableStatus = statusMessages[status] || status;

  // If final verification, mark trip as completed
  if (status === "delivery_verified") {
    trip.status = "completed";

    await Request.findByIdAndUpdate(trip.request_id._id, { status: "completed" });

    await Truck.findByIdAndUpdate(trip.truck_id, {
      status: "idle",
      $unset: { assigned_trip_id: 1 },
    });

    await User.findByIdAndUpdate(trip.driver_id, {
      $pull: { assigned_trip_id: trip._id },
    });
  }

  await trip.save();

  // 👉 Notifications
  const materialName = trip.request_id.material_id.name;
  const truckOwnerId = trip.request_id.truck_owner_id;
  const mineOwnerId = trip.mine_id.owner_id;
  const driverId = trip.driver_id;

  const payload = { tripId: trip._id.toString() };

  if (status === "pickup_verified") {
    // Mine owner verified pickup → notify truck owner + driver
    if (truckOwnerId) {
      await createNotification({
        recipient_id: truckOwnerId,
        type: "truck_milestone_verified",
        title: "Pickup Verified",
        message: `${readableStatus} for ${materialName} by mine owner.`,
        payload,
      });
    }

    if (driverId) {
      await createNotification({
        recipient_id: driverId,
        type: "driver_milestone_verified",
        title: "Pickup Verified",
        message: `${readableStatus} for ${materialName}.`,
        payload,
      });
    }
  }

  if (status === "delivery_verified") {
    // Truck owner verified delivery → notify mine owner + driver
    if (mineOwnerId) {
      await createNotification({
        recipient_id: mineOwnerId,
        type: "mine_milestone_verified",
        title: "Delivery Verified",
        message: `${readableStatus} for ${materialName} by truck owner.`,
        payload,
      });
    }

    if (driverId) {
      await createNotification({
        recipient_id: driverId,
        type: "driver_milestone_verified",
        title: "Delivery Verified",
        message: `${readableStatus} for ${materialName}.`,
        payload,
      });
    }
  }

  res.status(200).json({ success: true, data: trip });
});

/**
 * @route   PATCH /api/v1/trips/:id/location
 * @desc    Update live location of the truck (for Drivers)
 * @access  Private (Driver)
 */
export const updateLiveLocation = catchAsyncError(async (req, res, next) => {
  const { coordinates } = req.body;

  console.log("Updating live location for trip:", req.params.id, "with coordinates:", coordinates);

  const trip = await Trip.findByIdAndUpdate(req.params.id, { live_location: { type: "Point", coordinates, timestamp: new Date() } }, { new: true });

  if (!trip) return next(new ErrorHandler("Trip not found", 404));

  res.status(200).json({ success: true, message: "Location updated." });
});

/**
 * @route   PATCH /api/v1/trips/:id/report-issue
 * @desc    Report an issue with the trip (for Drivers)
 * @access  Private (Driver)
 */
export const reportIssue = catchAsyncError(async (req, res, next) => {
  const { reason, notes } = req.body;

  const trip = await Trip.findById(req.params.id)
    .populate("request_id", "truck_owner_id material_id")
    .populate({ path: "request_id", populate: { path: "material_id", select: "name" } })
    .populate("mine_id", "owner_id");

  if (!trip) return next(new ErrorHandler("Trip not found", 404));

  trip.status = "issue_reported";
  trip.issue = {
    reported_by: req.user._id,
    reason,
    notes,
    timestamp: new Date(),
  };

  await trip.save();

  // ✅ Notifications
  const materialName = trip.request_id.material_id.name;
  const truckOwnerId = trip.request_id.truck_owner_id;
  const mineOwnerId = trip.mine_id.owner_id;

  const payload = { tripId: trip._id.toString() };

  const messageText = `Issue reported for ${materialName}: ${reason || "unspecified reason"}`;

  if (mineOwnerId) {
    await createNotification({
      recipient_id: mineOwnerId,
      type: "mine_trip_issue",
      title: "Trip Issue Reported",
      message: messageText,
      payload,
    });
  }

  if (truckOwnerId) {
    await createNotification({
      recipient_id: truckOwnerId,
      type: "truck_trip_issue",
      title: "Trip Issue Reported",
      message: messageText,
      payload,
    });
  }

  res.status(200).json({
    success: true,
    message: "Issue reported successfully.",
    data: trip,
  });
});