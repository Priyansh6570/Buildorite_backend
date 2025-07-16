import Material from "../models/materialModel.js";
import Mine from "../models/mineModel.js";
import Request from "../models/requestModel.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import { applyQuery } from "../middleware/queryMiddleware.js";
import { createNotification } from "./notificationController.js";

// Create Material -> POST /materials
export const createMaterial = catchAsyncError(async (req, res, next) => {
  const { name, mine_id, prices, availability_status, photos } =
    req.body;
  const formattedPrices = prices.map((price) => ({
    unit: price.unit,
    price: Number(price.price),
    stock_quantity: Number(price.stock_quantity),
  }));

  const material = await Material.create({
    name,
    mine_id,
    prices: formattedPrices,
    availability_status: availability_status.toLowerCase(),
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

  if (!material) return next(new ErrorHandler("Material not found", 404));

  res.status(200).json({
    success: true,
    material,
  });
});

// Get Materials by Mine ID -> GET /mines/:mine_id
export const getMaterialsByMineId = catchAsyncError(async (req, res, next) => {
  const materials = await Material.find({ mine_id: req.params.mine_id });

  if (!materials) return next(new ErrorHandler("Materials not found", 404));

  res.status(200).json({
    success: true,
    materials,
  });
});

// Update Material -> PUT /materials/:id
export const updateMaterial = catchAsyncError(async (req, res, next) => {
  if (req.body.availability_status) {
    req.body.availability_status = req.body.availability_status.toLowerCase();
  }
  const material = await Material.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!material) return next(new ErrorHandler("Material not found", 404));

  res.status(200).json({
    success: true,
    material,
  });
});

// Delete Material -> DELETE /materials/:id
export const deleteMaterial = catchAsyncError(async (req, res, next) => {
  const material = await Material.findById(req.params.id);

  const requests = await Request.find({ material_id: material._id })
    .populate("mine_id")
    .populate("truck_owner_id");

  if (requests.length > 0) {
    for (const request of requests) {
      request.status = "canceled";
      request.rejection_reason = "Material has been removed by Mine Owner.";
      await request.save();

      await createNotification({
        recipient_id: request.mine_id.owner_id,
        type: "request_canceled",
        message: `A request for ${material.name} has been canceled as the material was removed.`,
        related_request_id: request._id,
      });

      await createNotification({
        recipient_id: request.truck_owner_id._id,
        type: "request_canceled",
        message: `Your request for ${material.name} has been canceled as the material was removed by the mine owner.`,
        related_request_id: request._id,
      });
    }
  }

  await material.deleteOne();

  res.status(200).json({
    success: true,
    message: "Material deleted, and associated requests were canceled.",
  });
});
