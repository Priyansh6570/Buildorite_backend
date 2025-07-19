import Material from "../models/materialModel.js";
import Unit from "../models/unitModel.js";
import Mine from "../models/mineModel.js";
import Request from "../models/requestModel.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import { createNotification } from "./notificationController.js";

/**
 * @route POST /api/v1/materials
 * @desc Create a new material, with on-the-fly unit creation.
 * @access Private
 */
export const createMaterial = catchAsyncError(async (req, res, next) => {
  const { name, mine_id, prices, properties, ...otherFields } = req.body;
  const user_id = req.user.id;

  if (!prices || prices.length === 0) {
    return next(new ErrorHandler("At least one price must be provided.", 400));
  }

  // Process prices: Create new units if necessary, otherwise use existing ID
  const processedPrices = await Promise.all(
    prices.map(async (price) => {
      let unitId;
      if (typeof price.unit === 'object' && price.unit !== null) {
        // Create a new unit if an object is provided
        const newUnit = await Unit.create({ ...price.unit, createdBy: user_id });
        unitId = newUnit._id;
      } else {
        // Use the existing unit ID if a string is provided
        unitId = price.unit;
      }
      return { ...price, unit: unitId };
    })
  );

  const material = await Material.create({
    name,
    mine_id,
    prices: processedPrices,
    properties,
    ...otherFields,
  });

  await Mine.findByIdAndUpdate(mine_id, { $push: { materials: material._id } });

  res.status(201).json({ success: true, material });
});

/**
 * @route GET /api/v1/materials
 * @desc Get all materials with populated unit info
 * @access Public
 */
export const getAllMaterials = catchAsyncError(async (req, res, next) => {
  const materials = await Material.find(req.query).populate({
    path: 'prices.unit',
    model: 'Unit'
  }).populate('mine_id', 'name location');

  res.status(200).json({ success: true, count: materials.length, materials });
});

/**
 * @route GET /api/v1/materials/:id
 * @desc Get a single material by its ID
 * @access Public
 */
export const getMaterialById = catchAsyncError(async (req, res, next) => {
  const material = await Material.findById(req.params.id).populate({
    path: 'prices.unit',
    select: 'name type baseUnit multiplier'
  });

  if (!material) return next(new ErrorHandler("Material not found", 404));

  res.status(200).json({ success: true, material });
});

/**
 * @route GET /api/v1/mines/:mine_id/materials
 * @desc Get all materials for a specific mine
 * @access Public
 */
export const getMaterialsByMineId = catchAsyncError(async (req, res, next) => {
  const materials = await Material.find({ mine_id: req.params.mine_id }).populate({
    path: 'prices.unit',
    model: 'Unit'
  });

  res.status(200).json({ success: true, materials });
});

/**
 * @route PUT /api/v1/materials/:id
 * @desc Update a material
 * @access Private
 */
export const updateMaterial = catchAsyncError(async (req, res, next) => {
  let material = await Material.findById(req.params.id);
  if (!material) return next(new ErrorHandler("Material not found", 404));

  material = await Material.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, material });
});

/**
 * @route DELETE /api/v1/materials/:id
 * @desc Delete a material and cancel related requests
 * @access Private
 */
export const deleteMaterial = catchAsyncError(async (req, res, next) => {
  const material = await Material.findById(req.params.id);
  if (!material) return next(new ErrorHandler("Material not found", 404));

  // Cancel any active requests for this material
  const requests = await Request.find({ material_id: material._id });
  if (requests.length > 0) {
    for (const request of requests) {
      if(request.status !== 'completed' && request.status !== 'canceled') {
        request.status = "canceled";
        request.rejection_reason = "Material has been removed by Mine Owner.";
        await request.save();
        // Send notifications
        await createNotification({ /* ... */ });
      }
    }
  }

  // Remove the material's ID from the parent mine's list
  await Mine.findByIdAndUpdate(material.mine_id, { $pull: { materials: material._id } });

  await material.deleteOne();

  res.status(200).json({ success: true, message: "Material deleted successfully" });
});