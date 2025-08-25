import Mine from "../models/mineModel.js";
import User from "../models/userModel.js";
import Material from "../models/materialModel.js";
import Request from "../models/requestModel.js";
import Trip from "../models/tripModel.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import ErrorHandler from "../utils/errorHandler.js";
import { applyQuery } from "../middleware/queryMiddleware.js";

// Create a new mine -> api/v1/mine/mines (Mine Owner only)
export const createMine = catchAsyncError(async (req, res, next) => {
  const { name, location, operational_hours, banner_images } = req.body;
  
  if (!Array.isArray(banner_images) || banner_images.some(img => !img.url || !img.public_id)) {
    return next(new ErrorHandler("Invalid banner_images format. Each image must have 'url' and 'public_id'.", 400));
  }  
  
  const mine = await Mine.create({
    name,
    location,
    operational_hours,
    banner_images,
    owner_id: req.user.id,
  });
  
  await User.findByIdAndUpdate(
    req.user.id,
    {
      $push: { mine_id: mine._id },
    },
    { new: true, runValidators: true }
  );

  res.status(201).json({
    success: true,
    mine,
  });
});

// Get all mines -> api/v1/mine/mines (Public)
export const getAllMines = applyQuery(Mine);

// Get mine by ID -> api/v1/mine/mines/:id
export const getMineById = catchAsyncError(async (req, res, next) => {
  const mine = await Mine.findById(req.params.id)
    .populate("owner_id", "name phone")
    .populate("materials")
    .populate('assigned_trucks');

  if (!mine) return next(new ErrorHandler("Mine not found", 404));

  res.status(200).json({
    success: true,
    mine,
  });
});

// Get all mines by logged in user -> api/v1/mine/my-mines (Mine Owner only)
export const getMyMines = catchAsyncError(async (req, res, next) => {
  const mines = await Mine.find({ owner_id: req.user.id }).sort("-createdAt");
  res.status(200).json({
    success: true,
    mines,
  });
});


// get count of mine and material
export const getMineAndMaterialCount = catchAsyncError(async (req, res, next) => {
  const [result] = await User.aggregate([
    { $match: { _id: req.user._id } },
    {
      $lookup: {
        from: "mines",
        localField: "mine_id",
        foreignField: "_id",
        as: "mines"
      }
    },
    { $unwind: "$mines" },
    {
      $lookup: {
        from: "materials",
        localField: "mines._id",
        foreignField: "mine_id",
        as: "mineMaterials"
      }
    },
    {
      $group: {
        _id: null,
        mineCount: { $addToSet: "$mines._id" },
        materialCount: { $sum: { $size: "$mineMaterials" } }
      }
    },
    {
      $project: {
        mineCount: { $size: "$mineCount" },
        materialCount: 1
      }
    }
  ]);

  res.status(200).json({
    success: true,
    mineCount: result?.mineCount || 0,
    materialCount: result?.materialCount || 0
  });
});

// Get global mine and material count
export const getGlobalMineAndMaterialCount = catchAsyncError(async (req, res, next) => {
  const [mineCount, materialCount] = await Promise.all([
    Mine.countDocuments(),
    Material.countDocuments()
  ]);

  res.status(200).json({
    success: true,
    mineCount,
    materialCount
  });
});

export const getTruckOwnerDriverStats = catchAsyncError(async (req, res, next) => {
  try {
    const truckOwnerId = req.user._id;
    const driverCount = await User.countDocuments({
      role: "driver",
      owner_id: truckOwnerId,
      truck_id: { $ne: null },
    });

    const userWithTrucks = await User.findById(truckOwnerId).populate("driver_ids", "truck_id");
    const truckIds = userWithTrucks?.driver_ids?.map(d => d.truck_id).filter(Boolean) || [];

    const completedTripCount = await Trip.countDocuments({
      truck_id: { $in: truckIds },
      status: "completed",
    });

    res.status(200).json({
      success: true,
      data: {
        driverCount,
        completedTripCount,
      },
    });
  } catch (error) {
    console.error("Error fetching truck owner driver stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


// Update mine -> api/v1/mine/mines/:id (Mine Owner only)
export const updateMine = catchAsyncError(async (req, res, next) => {
  let mine = await Mine.findById(req.params.id);
  if (!mine) return next(new ErrorHandler("Mine not found", 404));
  if (mine.owner_id.toString() !== req.user.id)
    return next(new ErrorHandler("You can only update your own mines", 403));
  
  mine = await Mine.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    mine,
  });
});

// Delete mine -> api/v1/mine/mines/:id (Mine Owner or Admin)
export const deleteMine = catchAsyncError(async (req, res, next) => {
  const mine = await Mine.findById(req.params.id);
  if (!mine) return next(new ErrorHandler("Mine not found", 404));

  if (mine.owner_id.toString() !== req.user.id && req.user.role !== "admin") {
    return next(
      new ErrorHandler("You can only delete your own mines or be an admin", 403)
    );
  }

  await Material.deleteMany({ mine_id: mine._id });
  await Request.deleteMany({ mine_id: mine._id });
  await Trip.deleteMany({ mine_id: mine._id });
  await User.findByIdAndUpdate(req.user.id, {
    $pull: { mine_id: mine._id },
  });

  await mine.deleteOne();
  res.status(200).json({
    success: true,
    message: "Mine and all related data deleted successfully",
  });
});
