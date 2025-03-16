import Material from '../models/materialModel.js';
import Mine from '../models/mineModel.js';
import ErrorHandler from '../utils/errorHandler.js';
import catchAsyncError from '../middleware/catchAsyncError.js';
import { applyQuery } from '../middleware/queryMiddleware.js';

// Create Material -> POST /materials
export const createMaterial = catchAsyncError(async (req, res, next) => {
  const { name, mine_id, prices, availability_status, stock_quantity, photos } = req.body;
  const formattedPrices = prices.map((price) => ({
    unit: price.unit,
    quantity: Number(price.quantity),
    price: Number(price.price),
  }));

  const material = await Material.create({
    name,
    mine_id,
    prices: formattedPrices,
    availability_status: availability_status.toLowerCase(),
    stock_quantity: Number(stock_quantity),
    photos,
  });

  await Mine.findByIdAndUpdate(
    mine_id,
    { $push: { materials: material._id } },
    { new: true, runValidators: true }
  );

  res.status(201).json({
    success: true,
    material,
  });
});

// Get all Materials -> GET /materials
export const getAllMaterials = applyQuery(Material);

// Get single Material -> GET /materials/:id
export const getMaterialById = catchAsyncError(async (req, res, next) => {
  const material = await Material.findById(req.params.id);

  if (!material) return next(new ErrorHandler('Material not found', 404));

  res.status(200).json({
    success: true,
    material,
  });
});

// Get Materials by Mine ID -> GET /mines/:mine_id
export const getMaterialsByMineId = catchAsyncError(async (req, res, next) => {
  const materials = await Material.find({ mine_id: req.params.mine_id });

  if (!materials) return next(new ErrorHandler('Materials not found', 404));

  res.status(200).json({
    success: true,
    materials,
  });
});

// Update Material -> PUT /materials/:id
export const updateMaterial = catchAsyncError(async (req, res, next) => {
  const material = await Material.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!material) return next(new ErrorHandler('Material not found', 404));

  res.status(200).json({
    success: true,
    material,
  });
});

// Delete Material -> DELETE /materials/:id
export const deleteMaterial = catchAsyncError(async (req, res, next) => {
  const material = await Material.findByIdAndDelete(req.params.id);

  if (!material) return next(new ErrorHandler('Material not found', 404));

  res.status(200).json({
    success: true,
    message: 'Material deleted successfully',
  });
});