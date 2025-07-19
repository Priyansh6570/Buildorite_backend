import Material from "../models/materialModel.js";
import Unit from "../models/unitModel.js";
import Mine from "../models/mineModel.js";
import Request from "../models/requestModel.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import { createNotification } from "./notificationController.js";

export const createMaterial = catchAsyncError(async (req, res, next) => {
  // Explicitly destructure all fields from the schema to avoid errors
  const {
    name,
    mine_id,
    prices,
    properties,
    description,
    tags,
    photos,
    availability_status
  } = req.body;

  const user_id = req.user.id; // From auth middleware

  if (!prices || prices.length === 0) {
    return next(new ErrorHandler("At least one price entry is required.", 400));
  }

  // Process prices to resolve unit IDs
  const processedPrices = await Promise.all(
    prices.map(async (price) => {
      let unitId;
      const unitData = price.unit;

      if (!unitData) {
        throw new Error('Unit data is missing in one of the price entries.');
      }

      // Case 1: unitData is an ObjectId string (from an existing DB unit)
      if (typeof unitData === 'string' && mongoose.Types.ObjectId.isValid(unitData)) {
        unitId = unitData;
      }
      // Case 2: unitData is an object (new custom unit OR predefined unit)
      else if (typeof unitData === 'object' && unitData !== null) {
        // Find if a unit with this name already exists to prevent duplicates
        let existingUnit = await Unit.findOne({ name: unitData.name });
        if (existingUnit) {
          unitId = existingUnit._id;
        } else {
          // If not found, create it. This works for both new custom units
          // from the form and predefined units not yet in the DB.
          const newUnit = await Unit.create({
            name: unitData.name,
            type: unitData.type,
            baseUnit: unitData.baseUnit,
            multiplier: unitData.multiplier,
            createdBy: user_id,
          });
          unitId = newUnit._id;
        }
      } else {
        // If the format is unrecognized, throw an error.
        throw new Error(`Invalid unit format received: ${JSON.stringify(unitData)}`);
      }

      return {
        price: price.price,
        stock_quantity: price.stock_quantity,
        minimum_order_quantity: price.minimum_order_quantity,
        unit: unitId // Assign the resolved ID
      };
    })
  );

  // Create the material with all the validated and processed data
  const material = await Material.create({
    name,
    mine_id,
    prices: processedPrices,
    properties,
    description,
    tags,
    photos,
    availability_status: availability_status || 'available',
  });

  // Add the new material's ID to the parent mine's list of materials
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