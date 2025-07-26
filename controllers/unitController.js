import Material from "../models/materialModel.js";
import Unit from "../models/unitModel.js";
import User from "../models/userModel.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncError from "../middleware/catchAsyncError.js";

/**
 * @route POST /api/v1/units
 * @desc Create a new unit
 * @access Private
 */
export const createUnit = catchAsyncError(async (req, res, next) => {
  const { name, type, baseUnit, multiplier, description } = req.body;
  const unit = await Unit.create({
    name,
    type,
    baseUnit,
    multiplier,
    description,
  });

  await User.findByIdAndUpdate(
    req.user.id,
    {
      $push: { created_unit_ids: unit._id },
    },
    { new: true, runValidators: true }
  );
  res.status(201).json({ success: true, unit });
});

/**
 * @route GET /api/v1/units
 * @desc Get all available units
 * @access Public
 */
export const getAllUnits = catchAsyncError(async (req, res, next) => {
  const units = await Unit.find(req.query);
  res.status(200).json({ success: true, count: units.length, units });
});

/**
 * @route GET /api/v1/units/:id
 * @desc Get a single unit by its ID
 * @access Public
 */
export const getUnitById = catchAsyncError(async (req, res, next) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) return next(new ErrorHandler("Unit not found", 404));
  res.status(200).json({ success: true, unit });
});


/**
 * @route GET /api/v1/units/my-units
 * @desc Get all units created by the currently logged-in user
 * @access Private
 */
export const getMyUnits = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate("created_unit_ids");
  if (!user) return next(new ErrorHandler("User not found", 404));
  const units = user.created_unit_ids;
  if (!units || units.length === 0) {
    return res.status(200).json({ success: true, count: 0, units: [] });
  }
  res.status(200).json({
    success: true,
    count: units.length,
    units,
  });
});

/**
 * @route PUT /api/v1/units/:id
 * @desc Update a unit
 * @access Private
 */
export const updateUnit = catchAsyncError(async (req, res, next) => {
  let unit = await Unit.findById(req.params.id);
  if (!unit) return next(new ErrorHandler("Unit not found", 404));

  // Optional: Check if the user trying to update is the one who created it
  if (unit.createdBy.toString() !== req.user.id) {
    return next(new ErrorHandler("User not authorized to update this unit", 403));
  }

  unit = await Unit.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, unit });
});

/**
 * @route DELETE /api/v1/units/:id
 * @desc Delete a unit
 * @access Private
 */
export const deleteUnit = catchAsyncError(async (req, res, next) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) return next(new ErrorHandler("Unit not found", 404));

  // Check if the unit is currently being used by any material
  const materialCount = await Material.countDocuments({ "prices.unit": req.params.id });
  if (materialCount > 0) {
    return next(new ErrorHandler(`Cannot delete unit. It is currently in use by ${materialCount} material(s).`, 400));
  }

  await unit.deleteOne();
  res.status(200).json({ success: true, message: "Unit deleted successfully" });
});