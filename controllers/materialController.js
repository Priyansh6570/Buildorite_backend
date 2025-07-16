import { Material, CustomUnit, CustomProperty } from "../models/materialModel.js";
import Mine from "../models/mineModel.js";
import Request from "../models/requestModel.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncError from "../middleware/catchAsyncError.js";
import { applyQuery } from "../middleware/queryMiddleware.js";
import { createNotification } from "./notificationController.js";

// Get standard units and unit types
export const getStandardUnits = catchAsyncError(async (req, res, next) => {
  const standardUnits = Material.getStandardUnits();
  const unitTypes = Material.getUnitTypes();
  
  res.status(200).json({
    success: true,
    standardUnits,
    unitTypes
  });
});

// Get common property suggestions
export const getCommonPropertySuggestions = catchAsyncError(async (req, res, next) => {
  const suggestions = Material.getCommonPropertySuggestions();
  
  res.status(200).json({
    success: true,
    suggestions
  });
});

// Create custom unit
export const createCustomUnit = catchAsyncError(async (req, res, next) => {
  const { name, symbol, type, baseUnit, multiplier, description } = req.body;
  
  // Check if unit with same name/symbol already exists for this user
  const existingUnit = await CustomUnit.findOne({
    createdBy: req.user._id,
    $or: [
      { name: name.trim() },
      { symbol: symbol.trim() }
    ]
  });
  
  if (existingUnit) {
    return next(new ErrorHandler("Unit with this name or symbol already exists", 400));
  }
  
  const customUnit = await CustomUnit.create({
    name: name.trim(),
    symbol: symbol.trim(),
    type,
    baseUnit,
    multiplier,
    description: description?.trim(),
    createdBy: req.user._id
  });
  
  res.status(201).json({
    success: true,
    customUnit
  });
});

// Get user's custom units
export const getUserCustomUnits = catchAsyncError(async (req, res, next) => {
  const customUnits = await CustomUnit.find({ createdBy: req.user._id });
  
  res.status(200).json({
    success: true,
    customUnits
  });
});

// Create custom property
export const createCustomProperty = catchAsyncError(async (req, res, next) => {
  const { name, type, unit, options, description } = req.body;
  
  // Check if property with same name already exists for this user
  const existingProperty = await CustomProperty.findOne({
    createdBy: req.user._id,
    name: name.trim()
  });
  
  if (existingProperty) {
    return next(new ErrorHandler("Property with this name already exists", 400));
  }
  
  const customProperty = await CustomProperty.create({
    name: name.trim(),
    type: type || 'text',
    unit: unit?.trim(),
    options: options || [],
    description: description?.trim(),
    createdBy: req.user._id
  });
  
  res.status(201).json({
    success: true,
    customProperty
  });
});

// Get user's custom properties
export const getUserCustomProperties = catchAsyncError(async (req, res, next) => {
  const customProperties = await CustomProperty.find({ createdBy: req.user._id });
  
  res.status(200).json({
    success: true,
    customProperties
  });
});

// Create Material -> POST /materials
export const createMaterial = catchAsyncError(async (req, res, next) => {
  const { 
    name, 
    mine_id, 
    prices, 
    properties, 
    availability_status, 
    photos, 
    description, 
    tags 
  } = req.body;
  
  // Validate mine ownership
  const mine = await Mine.findById(mine_id);
  if (!mine) {
    return next(new ErrorHandler("Mine not found", 404));
  }
  
  if (mine.owner_id.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("You can only add materials to your own mines", 403));
  }
  
  // Process prices - validate units
  const processedPrices = [];
  for (const price of prices) {
    const priceData = {
      unit: price.unit,
      price: Number(price.price),
      stock_quantity: Number(price.stock_quantity),
      minimum_order_quantity: price.minimum_order_quantity || 1
    };
    
    if (price.isCustomUnit) {
      // Validate custom unit exists and belongs to user
      const customUnit = await CustomUnit.findOne({
        _id: price.customUnit,
        createdBy: req.user._id
      });
      
      if (!customUnit) {
        return next(new ErrorHandler(`Custom unit not found: ${price.unit}`, 400));
      }
      
      priceData.isCustomUnit = true;
      priceData.customUnit = price.customUnit;
    } else {
      // Validate standard unit exists
      const standardUnits = Material.getStandardUnits();
      if (!standardUnits[price.unit]) {
        return next(new ErrorHandler(`Invalid standard unit: ${price.unit}`, 400));
      }
      
      priceData.isCustomUnit = false;
    }
    
    processedPrices.push(priceData);
  }
  
  // Process properties if provided
  const processedProperties = [];
  if (properties && properties.length > 0) {
    for (const property of properties) {
      const propertyData = {
        name: property.name,
        value: property.value,
        unit: property.unit,
        description: property.description
      };
      
      if (property.isCustomProperty) {
        // Validate custom property exists and belongs to user
        const customProperty = await CustomProperty.findOne({
          _id: property.customProperty,
          createdBy: req.user._id
        });
        
        if (!customProperty) {
          return next(new ErrorHandler(`Custom property not found: ${property.name}`, 400));
        }
        
        propertyData.isCustomProperty = true;
        propertyData.customProperty = property.customProperty;
      } else {
        propertyData.isCustomProperty = false;
      }
      
      processedProperties.push(propertyData);
    }
  }
  
  const material = await Material.create({
    name: name.trim(),
    mine_id,
    prices: processedPrices,
    properties: processedProperties,
    availability_status: availability_status?.toLowerCase() || 'available',
    photos: photos || [],
    description: description?.trim(),
    tags: tags?.map(tag => tag.trim()) || []
  });
  
  // Update mine materials array
  await Mine.findByIdAndUpdate(
    mine_id,
    { $push: { materials: material._id } },
    { new: true, runValidators: true }
  );
  
  res.status(201).json({
    success: true,
    material
  });
});

// Get all Materials -> GET /materials
export const getAllMaterials = applyQuery(Material, {
  populate: [
    { path: 'mine_id', select: 'name location owner_id' },
    { path: 'prices.customUnit' },
    { path: 'properties.customProperty' }
  ]
});

// Get single Material -> GET /materials/:id
export const getMaterialById = catchAsyncError(async (req, res, next) => {
  const material = await Material.findById(req.params.id)
    .populate('mine_id', 'name location owner_id')
    .populate('prices.customUnit')
    .populate('properties.customProperty');
  
  if (!material) {
    return next(new ErrorHandler("Material not found", 404));
  }
  
  // Increment view count
  await Material.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
  
  res.status(200).json({
    success: true,
    material
  });
});

// Get Materials by Mine ID -> GET /mines/:mine_id/materials
export const getMaterialsByMineId = catchAsyncError(async (req, res, next) => {
  const materials = await Material.find({ mine_id: req.params.mine_id })
    .populate('mine_id', 'name location owner_id')
    .populate('prices.customUnit')
    .populate('properties.customProperty');
  
  if (!materials || materials.length === 0) {
    return next(new ErrorHandler("No materials found for this mine", 404));
  }
  
  res.status(200).json({
    success: true,
    count: materials.length,
    materials
  });
});

// Update Material -> PUT /materials/:id
export const updateMaterial = catchAsyncError(async (req, res, next) => {
  let material = await Material.findById(req.params.id);
  
  if (!material) {
    return next(new ErrorHandler("Material not found", 404));
  }
  
  // Verify ownership
  const mine = await Mine.findById(material.mine_id);
  if (mine.owner_id.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("You can only update materials from your own mines", 403));
  }
  
  // Process update data
  const updateData = { ...req.body };
  
  if (updateData.availability_status) {
    updateData.availability_status = updateData.availability_status.toLowerCase();
  }
  
  // Process prices if provided
  if (updateData.prices) {
    const processedPrices = [];
    for (const price of updateData.prices) {
      const priceData = {
        unit: price.unit,
        price: Number(price.price),
        stock_quantity: Number(price.stock_quantity),
        minimum_order_quantity: price.minimum_order_quantity || 1
      };
      
      if (price.isCustomUnit) {
        // Validate custom unit exists and belongs to user
        const customUnit = await CustomUnit.findOne({
          _id: price.customUnit,
          createdBy: req.user._id
        });
        
        if (!customUnit) {
          return next(new ErrorHandler(`Custom unit not found: ${price.unit}`, 400));
        }
        
        priceData.isCustomUnit = true;
        priceData.customUnit = price.customUnit;
      } else {
        // Validate standard unit exists
        const standardUnits = Material.getStandardUnits();
        if (!standardUnits[price.unit]) {
          return next(new ErrorHandler(`Invalid standard unit: ${price.unit}`, 400));
        }
        
        priceData.isCustomUnit = false;
      }
      
      processedPrices.push(priceData);
    }
    updateData.prices = processedPrices;
  }
  
  // Process properties if provided
  if (updateData.properties) {
    const processedProperties = [];
    for (const property of updateData.properties) {
      const propertyData = {
        name: property.name,
        value: property.value,
        unit: property.unit,
        description: property.description
      };
      
      if (property.isCustomProperty) {
        // Validate custom property exists and belongs to user
        const customProperty = await CustomProperty.findOne({
          _id: property.customProperty,
          createdBy: req.user._id
        });
        
        if (!customProperty) {
          return next(new ErrorHandler(`Custom property not found: ${property.name}`, 400));
        }
        
        propertyData.isCustomProperty = true;
        propertyData.customProperty = property.customProperty;
      } else {
        propertyData.isCustomProperty = false;
      }
      
      processedProperties.push(propertyData);
    }
    updateData.properties = processedProperties;
  }
  
  material = await Material.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  }).populate('mine_id', 'name location owner_id')
    .populate('prices.customUnit')
    .populate('properties.customProperty');
  
  res.status(200).json({
    success: true,
    material
  });
});

// Delete Material -> DELETE /materials/:id
export const deleteMaterial = catchAsyncError(async (req, res, next) => {
  const material = await Material.findById(req.params.id);
  
  if (!material) {
    return next(new ErrorHandler("Material not found", 404));
  }
  
  // Verify ownership
  const mine = await Mine.findById(material.mine_id);
  if (mine.owner_id.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler("You can only delete materials from your own mines", 403));
  }
  
  // Handle pending requests
  const requests = await Request.find({ material_id: material._id })
    .populate("mine_id")
    .populate("truck_owner_id");
  
  if (requests.length > 0) {
    for (const request of requests) {
      request.status = "canceled";
      request.rejection_reason = "Material has been removed by Mine Owner.";
      await request.save();
      
      // Notify mine owner
      await createNotification({
        recipient_id: request.mine_id.owner_id,
        type: "request_canceled",
        message: `A request for ${material.name} has been canceled as the material was removed.`,
        related_request_id: request._id,
      });
      
      // Notify truck owner
      await createNotification({
        recipient_id: request.truck_owner_id._id,
        type: "request_canceled",
        message: `Your request for ${material.name} has been canceled as the material was removed by the mine owner.`,
        related_request_id: request._id,
      });
    }
  }
  
  // Remove material from mine's materials array
  await Mine.findByIdAndUpdate(
    material.mine_id,
    { $pull: { materials: material._id } }
  );
  
  await material.deleteOne();
  
  res.status(200).json({
    success: true,
    message: "Material deleted successfully, and associated requests were canceled."
  });
});

// Delete custom unit
export const deleteCustomUnit = catchAsyncError(async (req, res, next) => {
  const customUnit = await CustomUnit.findOne({
    _id: req.params.id,
    createdBy: req.user._id
  });
  
  if (!customUnit) {
    return next(new ErrorHandler("Custom unit not found", 404));
  }
  
  // Check if unit is being used in any materials
  const materialsUsingUnit = await Material.find({
    'prices.customUnit': customUnit._id
  });
  
  if (materialsUsingUnit.length > 0) {
    return next(new ErrorHandler("Cannot delete custom unit as it is being used in materials", 400));
  }
  
  await customUnit.deleteOne();
  
  res.status(200).json({
    success: true,
    message: "Custom unit deleted successfully"
  });
});

// Delete custom property
export const deleteCustomProperty = catchAsyncError(async (req, res, next) => {
  const customProperty = await CustomProperty.findOne({
    _id: req.params.id,
    createdBy: req.user._id
  });
  
  if (!customProperty) {
    return next(new ErrorHandler("Custom property not found", 404));
  }
  
  // Check if property is being used in any materials
  const materialsUsingProperty = await Material.find({
    'properties.customProperty': customProperty._id
  });
  
  if (materialsUsingProperty.length > 0) {
    return next(new ErrorHandler("Cannot delete custom property as it is being used in materials", 400));
  }
  
  await customProperty.deleteOne();
  
  res.status(200).json({
    success: true,
    message: "Custom property deleted successfully"
  });
});

// Search materials with advanced filters
export const searchMaterials = catchAsyncError(async (req, res, next) => {
  const {
    search,
    mine_id,
    availability_status,
    min_price,
    max_price,
    unit,
    properties,
    tags,
    location,
    page = 1,
    limit = 10
  } = req.query;
  
  const query = {};
  
  // Text search
  if (search) {
    query.$text = { $search: search };
  }
  
  // Filter by mine
  if (mine_id) {
    query.mine_id = mine_id;
  }
  
  // Filter by availability
  if (availability_status) {
    query.availability_status = availability_status;
  }
  
  // Filter by price range
  if (min_price || max_price) {
    const priceFilter = {};
    if (min_price) priceFilter.$gte = Number(min_price);
    if (max_price) priceFilter.$lte = Number(max_price);
    query['prices.price'] = priceFilter;
  }
  
  // Filter by unit
  if (unit) {
    query['prices.unit'] = unit;
  }
  
  // Filter by tags
  if (tags) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    query.tags = { $in: tagArray };
  }
  
  // Filter by properties
  if (properties) {
    const propertyFilters = JSON.parse(properties);
    propertyFilters.forEach(filter => {
      query[`properties.${filter.name}`] = filter.value;
    });
  }
  
  let aggregationPipeline = [
    { $match: query }
  ];
  
  // Add location filter if provided
  if (location) {
    aggregationPipeline.push({
      $lookup: {
        from: 'mines',
        localField: 'mine_id',
        foreignField: '_id',
        as: 'mine'
      }
    });
    
    aggregationPipeline.push({
      $match: {
        'mine.location': { $regex: location, $options: 'i' }
      }
    });
  }
  
  // Add pagination
  const skip = (page - 1) * limit;
  aggregationPipeline.push(
    { $skip: skip },
    { $limit: parseInt(limit) }
  );
  
  // Populate references
  aggregationPipeline.push(
    {
      $lookup: {
        from: 'mines',
        localField: 'mine_id',
        foreignField: '_id',
        as: 'mine_id'
      }
    },
    {
      $lookup: {
        from: 'customunits',
        localField: 'prices.customUnit',
        foreignField: '_id',
        as: 'customUnits'
      }
    },
    {
      $lookup: {
        from: 'customproperties',
        localField: 'properties.customProperty',
        foreignField: '_id',
        as: 'customProperties'
      }
    }
  );
  
  const materials = await Material.aggregate(aggregationPipeline);
  
  // Get total count for pagination
  const totalCount = await Material.countDocuments(query);
  
  res.status(200).json({
    success: true,
    materials,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
});