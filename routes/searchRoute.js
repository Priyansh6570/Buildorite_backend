import express from 'express';
import ErrorHandler from '../middleware/errorMiddleware.js';
import { applySearch } from '../middleware/searchMiddleware.js';
import Mine from '../models/mineModel.js';
import Material from '../models/materialModel.js';
import User from '../models/userModel.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  const modelMap = {
    mine: Mine,
    material: Material,
    user: User,
  };

  const model = modelMap[req.query.model];
  if (!model) {
    return next(new ErrorHandler(400, 'Invalid model'));
  }

  applySearch(model)(req, res, next);
});

export default router;