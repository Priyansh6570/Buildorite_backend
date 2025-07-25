import { buildSearchQuery } from "../utils/searchUtils.js";
import { buildQuery } from "../utils/queryUtils.js";

export const applySearch = (Model) => {
  return async (req, res, next) => {
    try {
      const { model, searchTerm, page, limit, sortBy, order, lat, lng, roles } = req.query;
      const userCoordinates = lat && lng ? [parseFloat(lng), parseFloat(lat)] : null;
      if (!model) {
        return res
          .status(400)
          .json({ success: false, message: "Model is required for search." });
      }
      const roleFilter = roles ? { role: { $in: roles.split(',') } } : null;

      // 1. Build the base search pipeline (it no longer creates duplicates)
      let pipeline = buildSearchQuery(model, searchTerm);

      // 2. Apply role filter if it exists
      if (roleFilter) {
        pipeline.push({ $match: roleFilter });
      }
      
      // 4. Get total count for pagination
      const countPipeline = [...pipeline, { $count: "totalCount" }];
      const countResult = await Model.aggregate(countPipeline);
      const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;
      const totalPages = Math.ceil(totalCount / (parseInt(limit) || 10));

      // 5. Apply sorting, pagination to the main query
      let query = Model.aggregate(pipeline);
      buildQuery(query, { page, limit, sortBy, order, userCoordinates });
      const results = await query.exec();

      res.status(200).json({
        success: true,
        totalCount,
        totalPages,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  };
};