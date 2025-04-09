import { buildQuery } from "../utils/queryUtils.js";

export const applyQuery = (Model) => {
  return async (req, res, next) => {
    try {
      const { page, limit, sortBy, order, lat, lng} = req.query;
      const userCoordinates = lat && lng ? [parseFloat(lng), parseFloat(lat)] : null;

      let query = Model.find();

      buildQuery(query, { page, limit, sortBy, order, userCoordinates });

      const results = await query.exec();
      const totalCount = await Model.countDocuments();
      const totalPages = Math.ceil(totalCount / (parseInt(limit) || 10));
      
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