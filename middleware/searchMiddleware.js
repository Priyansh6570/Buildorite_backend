import { buildSearchQuery } from '../utils/searchUtils.js';
import { buildQuery } from '../utils/queryUtils.js';

export const applySearch = (Model) => {
  return async (req, res, next) => {
    try {
      const { model, searchTerm, page, limit, sortBy, order, lat, lng } = req.query;

      const userCoordinates = lat && lng ? [parseFloat(lng), parseFloat(lat)] : null;
      
      if (!model) {
        return res.status(400).json({ success: false, message: 'Model is required for search.' });
      }
      
      let pipeline = buildSearchQuery(model, searchTerm);
      
      pipeline = [
        ...pipeline,
        {
          $group: {
            _id: "$_id",
            doc: { $first: "$$ROOT" }
          }
        },
        {
          $replaceRoot: { newRoot: "$doc" }
        }
      ];
      
      const countPipeline = [...pipeline, { $count: 'totalCount' }];
      const countResult = await Model.aggregate(countPipeline);
      const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;
      let query = Model.aggregate(pipeline);
      buildQuery(query, { page, limit, sortBy, order, userCoordinates });
      
      const results = await query.exec();
      
      res.status(200).json({
        success: true,
        totalCount,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  };
};