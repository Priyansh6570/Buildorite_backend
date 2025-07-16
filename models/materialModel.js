import mongoose from "mongoose";

const STANDARD_UNITS = {
  MT: { 
    name: "Metric Ton", 
    symbol: "MT", 
    type: "weight", 
    baseUnit: "kg", 
    multiplier: 1000,
    description: "Standard unit for bulk materials"
  },
  KG: { 
    name: "Kilogram", 
    symbol: "kg", 
    type: "weight", 
    baseUnit: "kg", 
    multiplier: 1,
    description: "For smaller quantities"
  },
  QTL: { 
    name: "Quintal", 
    symbol: "qtl", 
    type: "weight", 
    baseUnit: "kg", 
    multiplier: 100,
    description: "100 kg unit, common in Indian trade"
  },
  G: { 
    name: "Gram", 
    symbol: "g", 
    type: "weight", 
    baseUnit: "kg", 
    multiplier: 0.001,
    description: "For precious materials and samples"
  },
  
  // Volume-based units
  M3: { 
    name: "Cubic Meter", 
    symbol: "m³", 
    type: "volume", 
    baseUnit: "m³", 
    multiplier: 1,
    description: "Standard volume unit for sand, gravel"
  },
  FT3: { 
    name: "Cubic Feet", 
    symbol: "ft³", 
    type: "volume", 
    baseUnit: "m³", 
    multiplier: 0.0283168,
    description: "Alternative volume measurement"
  },
  L: { 
    name: "Liter", 
    symbol: "L", 
    type: "volume", 
    baseUnit: "m³", 
    multiplier: 0.001,
    description: "For liquid materials"
  },
  
  // Count-based units
  PCS: { 
    name: "Pieces", 
    symbol: "pcs", 
    type: "count", 
    baseUnit: "pcs", 
    multiplier: 1,
    description: "For stones, boulders, individual items"
  },
  BAG_25: { 
    name: "Bag (25kg)", 
    symbol: "bag", 
    type: "package", 
    baseUnit: "kg", 
    multiplier: 25,
    description: "Standard 25kg bag"
  },
  BAG_50: { 
    name: "Bag (50kg)", 
    symbol: "bag", 
    type: "package", 
    baseUnit: "kg", 
    multiplier: 50,
    description: "Standard 50kg bag"
  },
  
  // Vehicle-based units
  TRUCK_SMALL: { 
    name: "Small Truck", 
    symbol: "truck", 
    type: "vehicle", 
    baseUnit: "MT", 
    multiplier: 3,
    description: "Small truck capacity (~3 MT)"
  },
  TRUCK_MEDIUM: { 
    name: "Medium Truck", 
    symbol: "truck", 
    type: "vehicle", 
    baseUnit: "MT", 
    multiplier: 7,
    description: "Medium truck capacity (~7 MT)"
  },
  TRUCK_LARGE: { 
    name: "Large Truck", 
    symbol: "truck", 
    type: "vehicle", 
    baseUnit: "MT", 
    multiplier: 15,
    description: "Large truck capacity (~15 MT)"
  },
  DUMPER: { 
    name: "Dumper", 
    symbol: "dumper", 
    type: "vehicle", 
    baseUnit: "MT", 
    multiplier: 10,
    description: "Standard dumper capacity (~10 MT)"
  }
};

// Unit types for custom unit creation
const UNIT_TYPES = {
  weight: {
    name: "Weight",
    baseUnits: ["kg", "g", "MT", "ton"],
    description: "Weight-based measurements"
  },
  volume: {
    name: "Volume", 
    baseUnits: ["m³", "L", "ft³", "gallon"],
    description: "Volume-based measurements"
  },
  count: {
    name: "Count",
    baseUnits: ["pcs", "units", "items"],
    description: "Count-based measurements"
  },
  package: {
    name: "Package",
    baseUnits: ["kg", "L", "pcs"],
    description: "Package-based measurements (bags, boxes, etc.)"
  },
  vehicle: {
    name: "Vehicle",
    baseUnits: ["MT", "m³", "kg"],
    description: "Vehicle-based measurements"
  },
  area: {
    name: "Area",
    baseUnits: ["m²", "ft²", "acre"],
    description: "Area-based measurements"
  },
  length: {
    name: "Length",
    baseUnits: ["m", "ft", "cm", "inch"],
    description: "Length-based measurements"
  }
};

// Common property suggestions (not mandatory)
const COMMON_PROPERTY_SUGGESTIONS = {
  // Quality related
  grade: {
    type: "select",
    options: ["Grade A", "Grade B", "Grade C", "Premium", "Standard", "Economic"],
    description: "Quality grade of the material"
  },
  purity: {
    type: "number",
    unit: "%",
    description: "Purity percentage"
  },
  
  // Physical properties
  size: {
    type: "text",
    placeholder: "e.g., 0-5mm, 10-20mm, Mixed",
    description: "Size range of the material"
  },
  color: {
    type: "text",
    placeholder: "e.g., Red, Grey, Mixed",
    description: "Color of the material"
  },
  hardness: {
    type: "select",
    options: ["Soft", "Medium", "Hard", "Very Hard"],
    description: "Hardness level"
  },
  
  // Origin and source
  origin: {
    type: "text",
    placeholder: "e.g., Rajasthan, Local quarry",
    description: "Origin/source of the material"
  },
  mine_type: {
    type: "select",
    options: ["Open pit", "Underground", "Quarry", "River bed", "Other"],
    description: "Type of mine or extraction method"
  },
  
  // Chemical properties
  moisture_content: {
    type: "number",
    unit: "%",
    description: "Moisture content percentage"
  },
  ph_level: {
    type: "number",
    unit: "pH",
    description: "pH level of the material"
  },
  
  // Construction specific
  crushing_strength: {
    type: "number",
    unit: "MPa",
    description: "Crushing strength"
  },
  water_absorption: {
    type: "number",
    unit: "%",
    description: "Water absorption percentage"
  }
};

// Custom unit schema for user-defined units
const customUnitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, "Unit name cannot exceed 50 characters"]
  },
  symbol: {
    type: String,
    required: true,
    trim: true,
    maxlength: [10, "Unit symbol cannot exceed 10 characters"]
  },
  type: {
    type: String,
    required: true,
    enum: Object.keys(UNIT_TYPES)
  },
  baseUnit: {
    type: String,
    required: true,
    validate: {
      validator: function(value) {
        return UNIT_TYPES[this.type].baseUnits.includes(value);
      },
      message: "Base unit must be valid for the selected type"
    }
  },
  multiplier: {
    type: Number,
    required: true,
    min: [0.000001, "Multiplier must be positive"]
  },
  description: {
    type: String,
    maxlength: [200, "Description cannot exceed 200 characters"]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

// Custom property schema
const customPropertySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, "Property name cannot exceed 50 characters"]
  },
  type: {
    type: String,
    enum: ["text", "number", "select", "boolean"],
    default: "text"
  },
  unit: {
    type: String,
    maxlength: [20, "Unit cannot exceed 20 characters"]
  },
  options: [{
    type: String,
    maxlength: [100, "Option cannot exceed 100 characters"]
  }],
  description: {
    type: String,
    maxlength: [200, "Description cannot exceed 200 characters"]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

// Price schema with flexible units
const priceSchema = new mongoose.Schema({
  unit: {
    type: String,
    required: [true, "Unit is required"]
  },
  isCustomUnit: {
    type: Boolean,
    default: false
  },
  customUnit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CustomUnit"
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: [0, "Price cannot be negative"]
  },
  stock_quantity: {
    type: Number,
    required: [true, "Stock quantity is required"],
    min: [0, "Stock cannot be negative"]
  },
  minimum_order_quantity: {
    type: Number,
    default: 1,
    min: [1, "Minimum order quantity must be at least 1"]
  }
});

// Validate unit reference
priceSchema.pre('validate', function(next) {
  if (this.isCustomUnit && !this.customUnit) {
    next(new Error('Custom unit reference is required when isCustomUnit is true'));
  } else if (!this.isCustomUnit && !STANDARD_UNITS[this.unit]) {
    next(new Error('Invalid standard unit selected'));
  } else {
    next();
  }
});

// Material property schema
const materialPropertySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  unit: {
    type: String,
    trim: true
  },
  isCustomProperty: {
    type: Boolean,
    default: false
  },
  customProperty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CustomProperty"
  },
  description: {
    type: String,
    maxlength: [200, "Description cannot exceed 200 characters"]
  }
});

const materialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Material name is required"],
    trim: true,
    maxlength: [100, "Material name cannot exceed 100 characters"]
  },
  mine_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Mine",
    required: true
  },
  prices: [priceSchema],
  properties: [materialPropertySchema],
  availability_status: {
    type: String,
    enum: ["available", "unavailable", "limited"],
    default: "available"
  },
  photos: [{
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    caption: String
  }],
  description: {
    type: String,
    maxlength: [500, "Description cannot exceed 500 characters"]
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, "Tag cannot exceed 50 characters"]
  }],
  views: { type: Number, default: 0 },
  orders_count: { type: Number, default: 0 }
}, {
  timestamps: true
});

materialSchema.index({ name: 'text', description: 'text', tags: 'text' });
materialSchema.index({ mine_id: 1, availability_status: 1 });
materialSchema.index({ 'properties.name': 1, 'properties.value': 1 });

// Static methods
materialSchema.statics.getStandardUnits = function() {
  return STANDARD_UNITS;
};

materialSchema.statics.getUnitTypes = function() {
  return UNIT_TYPES;
};

materialSchema.statics.getCommonPropertySuggestions = function() {
  return COMMON_PROPERTY_SUGGESTIONS;
};

// Instance methods
materialSchema.methods.getUnitDetails = function() {
  return this.prices.map(price => {
    if (price.isCustomUnit) {
      return {
        ...price.toObject(),
        unitInfo: price.customUnit
      };
    } else {
      return {
        ...price.toObject(),
        unitInfo: STANDARD_UNITS[price.unit]
      };
    }
  });
};

const Material = mongoose.models.Material || mongoose.model("Material", materialSchema);
const CustomUnit = mongoose.models.CustomUnit || mongoose.model("CustomUnit", customUnitSchema);
const CustomProperty = mongoose.models.CustomProperty || mongoose.model("CustomProperty", customPropertySchema);

export { Material, CustomUnit, CustomProperty };
export default Material;