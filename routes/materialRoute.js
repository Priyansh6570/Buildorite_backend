import express from 'express';

// Import all required controller functions
import {
  createMaterial,
  getAllMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  getMaterialsByMineId,
} from '../controllers/materialController.js';

import {
  createUnit,
  getAllUnits,
  getUnitById,
  getMyUnits,
  updateUnit,
  deleteUnit,
} from '../controllers/unitController.js';

// Import your authentication middleware
// Make sure the path is correct for your project structure
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

//===============================
// Material Routes
//===============================

// Get all materials and create a new material
router.route('/')
  .get(getAllMaterials)
  .post(protect, authorizeRoles('mine_owner'), createMaterial);

// Get all materials for a specific mine
router.route('/mine/:mine_id').get(getMaterialsByMineId);

// Operations on a single material by its ID
router.route('/:id')
  .get(getMaterialById)
  .put(protect, authorizeRoles('mine_owner'), updateMaterial)
  .delete(protect, authorizeRoles('mine_owner'), deleteMaterial);


//===============================
// Unit Routes
//===============================

// Get all units and create a new unit
router.route('/units/d')
  .get(protect, getAllUnits)
  .post(protect, createUnit);

// Get units created by the currently logged-in user
router.route('/units/my-units')
  .get(protect, getMyUnits);

// Operations on a single unit by its ID
router.route('/units/:id')
  .get(getUnitById)
  .put(protect, authorizeRoles('mine_owner'), updateUnit)
  .delete(protect, authorizeRoles('mine_owner'), deleteUnit);


export default router;