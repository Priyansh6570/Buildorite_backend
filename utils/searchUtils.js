import { searchFields } from "../config/searchConfig.js";

export const buildSearchQuery = (model, searchTerm) => {
  if (!searchTerm) return [];

  const config = searchFields[model] || [];
  const pipeline = [];
  const orConditions = [];

  config
    .filter((field) => !field.ref)
    .forEach((field) => {
      orConditions.push({
        [field.field]: { $regex: searchTerm, $options: "i" },
      });
    });

  const refConfigs = config.filter((field) => field.ref);

  refConfigs.forEach((refConfig) => {
    pipeline.push({
      $lookup: {
        from: refConfig.refModel.toLowerCase() + "s",
        localField: refConfig.ref,
        foreignField: "_id",
        as: `${refConfig.ref}_details`,
      },
    });

    pipeline.push({
      $unwind: {
        path: `$${refConfig.ref}_details`,
        preserveNullAndEmptyArrays: true,
      },
    });

    refConfig.fields.forEach((subField) => {
      orConditions.push({
        [`${refConfig.ref}_details.${subField}`]: {
          $regex: searchTerm,
          $options: "i",
        },
      });
    });
  });

  if (orConditions.length > 0) {
    pipeline.push({
      $match: { $or: orConditions },
    });
  }

  return pipeline;
};
