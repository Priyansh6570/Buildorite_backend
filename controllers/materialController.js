import Material from "../models/materialModel.js";
import Unit from "../models/unitModel.js";
import User from "../models/userModel.js";
import Mine from "../models/mineModel.js";
import Request from "../models/requestModel.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import { createNotification } from "./notificationController.js";
import mongoose from "mongoose";

export const createMaterial = catchAsyncError(async (req, res, next) => {
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

  const user_id = req.user.id;

  if (!prices || prices.length === 0) {
    return next(new ErrorHandler("At least one price entry is required.", 400));
  }

  const processedPrices = await Promise.all(
    prices.map(async (price) => {
      let unitId;
      const unitData = price.unit;

      if (!unitData) throw new Error('Unit data missing');

      if (typeof unitData === 'string' && mongoose.Types.ObjectId.isValid(unitData)) {
        unitId = unitData;
      } else if (typeof unitData === 'object' && unitData !== null) {
        let existingUnit = await Unit.findOne({ name: unitData.name });

        if (existingUnit) {
          unitId = existingUnit._id;
          const user = await User.findById(user_id);
          if (!user.created_unit_ids.includes(unitId)) {
            await User.findByIdAndUpdate(user_id, { $push: { created_unit_ids: unitId } });
          }
        } else {
          const newUnit = await Unit.create({
            name: unitData.name,
            type: unitData.type,
            baseUnit: unitData.baseUnit,
            multiplier: unitData.multiplier,
          });
          unitId = newUnit._id;
          await User.findByIdAndUpdate(user_id, { $push: { created_unit_ids: unitId } });
        }
      } else {
        throw new Error(`Invalid unit format: ${JSON.stringify(unitData)}`);
      }

      return {
        price: price.price,
        stock_quantity: price.stock_quantity,
        minimum_order_quantity: price.minimum_order_quantity,
        unit: unitId
      };
    })
  );

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

  await Mine.findByIdAndUpdate(mine_id, { $push: { materials: material._id } });

  res.status(201).json({ success: true, material });
});

export const getAllMaterials = catchAsyncError(async (req, res, next) => {
  const materials = await Material.find(req.query).populate({
    path: 'prices.unit',
    model: 'Unit'
  }).populate('mine_id', 'name location');

  res.status(200).json({ success: true, count: materials.length, materials });
});

export const getMaterialById = catchAsyncError(async (req, res, next) => {
  const material = await Material.findById(req.params.id).populate({
    path: 'prices.unit',
    select: 'name type baseUnit multiplier'
  });

  if (!material) return next(new ErrorHandler("Material not found", 404));

  res.status(200).json({ success: true, material });
});

export const getMaterialsByMineId = catchAsyncError(async (req, res, next) => {
  const materials = await Material.find({ mine_id: req.params.mine_id }).populate({
    path: 'prices.unit',
    model: 'Unit'
  });
  res.status(200).json({ success: true, materials });
});

export const updateMaterial = catchAsyncError(async (req, res, next) => {
  let material = await Material.findById(req.params.id);
  if (!material) return next(new ErrorHandler("Material not found", 404));

  material = await Material.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, material });
});

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