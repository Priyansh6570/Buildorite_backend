import { Material, CustomUnit } from '../models/materialModel.js';

/**
 * Unit conversion utility for materials
 */
class UnitConverter {
  constructor() {
    this.standardUnits = Material.getStandardUnits();
  }

  /**
   * Convert quantity from one unit to another
   * @param {number} quantity - Amount to convert
   * @param {string} fromUnit - Source unit
   * @param {string} toUnit - Target unit
   * @param {object} customUnits - Custom units lookup object
   * @returns {number|null} - Converted quantity or null if conversion not possible
   */
  convert(quantity, fromUnit, toUnit, customUnits = {}) {
    if (fromUnit === toUnit) {
      return quantity;
    }

    const fromUnitInfo = this.getUnitInfo(fromUnit, customUnits);
    const toUnitInfo = this.getUnitInfo(toUnit, customUnits);

    if (!fromUnitInfo || !toUnitInfo) {
      return null;
    }

    // Can only convert between units of same type with same base unit
    if (fromUnitInfo.type !== toUnitInfo.type || fromUnitInfo.baseUnit !== toUnitInfo.baseUnit) {
      return null;
    }

    // Convert to base unit first, then to target unit
    const baseQuantity = quantity * fromUnitInfo.multiplier;
    const convertedQuantity = baseQuantity / toUnitInfo.multiplier;

    return convertedQuantity;
  }

  /**
   * Get unit information (standard or custom)
   * @param {string} unit - Unit identifier
   * @param {object} customUnits - Custom units lookup object
   * @returns {object|null} - Unit information or null if not found
   */
  getUnitInfo(unit, customUnits = {}) {
    // Check standard units first
    if (this.standardUnits[unit]) {
      return this.standardUnits[unit];
    }

    // Check custom units
    if (customUnits[unit]) {
      return customUnits[unit];
    }

    return null;
  }

  /**
   * Get all compatible units for a given unit
   * @param {string} unit - Source unit
   * @param {object} customUnits - Custom units lookup object
   * @returns {array} - Array of compatible unit identifiers
   */
  getCompatibleUnits(unit, customUnits = {}) {
    const unitInfo = this.getUnitInfo(unit, customUnits);
    if (!unitInfo) {
      return [];
    }

    const compatibleUnits = [];

    // Check standard units
    Object.keys(this.standardUnits).forEach(standardUnit => {
      const standardUnitInfo = this.standardUnits[standardUnit];
      if (standardUnitInfo.type === unitInfo.type && 
          standardUnitInfo.baseUnit === unitInfo.baseUnit) {
        compatibleUnits.push(standardUnit);
      }
    });

    // Check custom units
    Object.keys(customUnits).forEach(customUnit => {
      const customUnitInfo = customUnits[customUnit];
      if (customUnitInfo.type === unitInfo.type && 
          customUnitInfo.baseUnit === unitInfo.baseUnit) {
        compatibleUnits.push(customUnit);
      }
    });

    return compatibleUnits;
  }

  /**
   * Format quantity with unit
   * @param {number} quantity - Amount
   * @param {string} unit - Unit identifier
   * @param {object} customUnits - Custom units lookup object
   * @returns {string} - Formatted string
   */
  formatQuantity(quantity, unit, customUnits = {}) {
    const unitInfo = this.getUnitInfo(unit, customUnits);
    if (!unitInfo) {
      return `${quantity} ${unit}`;
    }

    return `${quantity} ${unitInfo.symbol}`;
  }

  /**
   * Calculate total stock across all price units for a material
   * @param {array} prices - Array of price objects
   * @param {string} targetUnit - Unit to convert all stock to
   * @param {object} customUnits - Custom units lookup object
   * @returns {number} - Total stock in target unit
   */
  calculateTotalStock(prices, targetUnit, customUnits = {}) {
    let totalStock = 0;

    prices.forEach(price => {
      const convertedStock = this.convert(
        price.stock_quantity,
        price.unit,
        targetUnit,
        customUnits
      );

      if (convertedStock !== null) {
        totalStock += convertedStock;
      }
    });

    return totalStock;
  }

  /**
   * Find best price per unit across different units
   * @param {array} prices - Array of price objects
   * @param {string} compareUnit - Unit to compare prices in
   * @param {object} customUnits - Custom units lookup object
   * @returns {object} - Best price information
   */
  findBestPrice(prices, compareUnit, customUnits = {}) {
    let bestPrice = null;
    let bestPriceInfo = null;

    prices.forEach(price => {
      const convertedPrice = this.convertPrice(
        price.price,
        price.unit,
        compareUnit,
        customUnits
      );

      if (convertedPrice !== null && 
          (bestPrice === null || convertedPrice < bestPrice)) {
        bestPrice = convertedPrice;
        bestPriceInfo = {
          ...price,
          convertedPrice,
          compareUnit
        };
      }
    });

    return bestPriceInfo;
  }

  /**
   * Convert price from one unit to another
   * @param {number} price - Price amount
   * @param {string} fromUnit - Source unit
   * @param {string} toUnit - Target unit
   * @param {object} customUnits - Custom units lookup object
   * @returns {number|null} - Converted price or null if conversion not possible
   */
  convertPrice(price, fromUnit, toUnit, customUnits = {}) {
    // Price conversion is inverse of quantity conversion
    const conversionFactor = this.convert(1, toUnit, fromUnit, customUnits);
    
    if (conversionFactor === null) {
      return null;
    }

    return price * conversionFactor;
  }

  /**
   * Validate unit compatibility for material operations
   * @param {string} unit1 - First unit
   * @param {string} unit2 - Second unit
   * @param {object} customUnits - Custom units lookup object
   * @returns {boolean} - True if units are compatible
   */
  areUnitsCompatible(unit1, unit2, customUnits = {}) {
    const unit1Info = this.getUnitInfo(unit1, customUnits);
    const unit2Info = this.getUnitInfo(unit2, customUnits);

    if (!unit1Info || !unit2Info) {
      return false;
    }

    return unit1Info.type === unit2Info.type && 
           unit1Info.baseUnit === unit2Info.baseUnit;
  }

  /**
   * Get units grouped by type
   * @param {object} customUnits - Custom units lookup object
   * @returns {object} - Units grouped by type
   */
  getUnitsByType(customUnits = {}) {
    const unitsByType = {};

    // Add standard units
    Object.keys(this.standardUnits).forEach(unit => {
      const unitInfo = this.standardUnits[unit];
      if (!unitsByType[unitInfo.type]) {
        unitsByType[unitInfo.type] = [];
      }
      unitsByType[unitInfo.type].push({
        id: unit,
        ...unitInfo,
        isCustom: false
      });
    });

    // Add custom units
    Object.keys(customUnits).forEach(unit => {
      const unitInfo = customUnits[unit];
      if (!unitsByType[unitInfo.type]) {
        unitsByType[unitInfo.type] = [];
      }
      unitsByType[unitInfo.type].push({
        id: unit,
        ...unitInfo,
        isCustom: true
      });
    });

    return unitsByType;
  }
}

export default UnitConverter;