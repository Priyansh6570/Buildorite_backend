import express from 'express';
import {
  createMaterial,
  getAllMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  getMaterialsByMineId,
} from '../controllers/materialController.js';

import { addMaterialView } from '../controllers/materialController.js';

import {
  createUnit,
  getAllUnits,
  getUnitById,
  getMyUnits,
  updateUnit,
  deleteUnit,
} from '../controllers/unitController.js';

import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getAllMaterials)
  .post(protect, authorizeRoles('mine_owner'), createMaterial);

router.route('/mine/:mine_id').get(getMaterialsByMineId);

router.route('/:id')
  .get(getMaterialById)
  .put(protect, authorizeRoles('mine_owner'), updateMaterial)
  .delete(protect, authorizeRoles('mine_owner'), deleteMaterial);


router.route('/units/d')
  .get(protect, getAllUnits)
  .post(protect, createUnit);

router.route('/units/my-units')
  .get(protect, getMyUnits);

router.route('/units/:id')
  .get(getUnitById)
  .put(protect, authorizeRoles('mine_owner'), updateUnit)
  .delete(protect, authorizeRoles('mine_owner'), deleteUnit);

router.route('/:id/view')
  .post(protect, addMaterialView);

export default router;