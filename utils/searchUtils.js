import { searchFields } from '../config/searchConfig.js';

export const buildSearchQuery = (model, searchTerm) => {
  if (!searchTerm) return [];

  const fields = searchFields[model] || [];
  const pipeline = [];
  const matchQueries = [];

  fields.forEach((field) => {
    if (field.isRef) {
      pipeline.push(
        {
          $lookup: {
            from: field.refModel.toLowerCase() + 's',
            localField: field.field,
            foreignField: '_id',
            as: `${field.field}_details`,
          },
        },
        {
          $unwind: {
            path: `$${field.field}_details`,
            preserveNullAndEmptyArrays: true,
          },
        }
      );

      matchQueries.push({
        [`${field.field}_details.${field.refField}`]: {
          $regex: searchTerm,
          $options: 'i',
        },
      });
    } else {
      matchQueries.push({
        [field.field]: { $regex: searchTerm, $options: 'i' },
      });
    }
  });
  if (matchQueries.length > 0) {
    pipeline.push({
      $match: { $or: matchQueries },
    });
  }

  return pipeline;
};