import { searchFields } from '../config/searchConfig.js';

export const buildSearchQuery = (model, searchTerm) => {
  if (!searchTerm) return [];

  const config = searchFields[model] || [];
  const pipeline = [];
  const orConditions = [];

  // Process direct fields first
  config
    .filter((field) => !field.ref)
    .forEach((field) => {
      orConditions.push({
        [field.field]: { $regex: searchTerm, $options: 'i' },
      });
    });

  // Process referenced fields
  const refConfigs = config.filter((field) => field.ref);

  refConfigs.forEach((refConfig) => {
    // Add a single $lookup stage for each reference
    pipeline.push({
      $lookup: {
        from: refConfig.refModel.toLowerCase() + 's', // e.g., 'users', 'mines'
        localField: refConfig.ref,
        foreignField: '_id',
        as: `${refConfig.ref}_details`,
      },
    });

    // Unwind the result of the lookup
    // Using preserveNullAndEmptyArrays to not lose documents that don't have the reference
    pipeline.push({
      $unwind: {
        path: `$${refConfig.ref}_details`,
        preserveNullAndEmptyArrays: true,
      },
    });

    // Add search conditions for all fields within this reference to the main $or array
    refConfig.fields.forEach((subField) => {
      orConditions.push({
        [`${refConfig.ref}_details.${subField}`]: {
          $regex: searchTerm,
          $options: 'i',
        },
      });
    });
  });

  // Add a single $match stage with all conditions combined
  if (orConditions.length > 0) {
    pipeline.push({
      $match: { $or: orConditions },
    });
  }

  return pipeline;
};