import express from 'express';
import { 
  // Material CRUD operations
  createMaterial, 
  getAllMaterials, 
  getMaterialById, 
  updateMaterial, 
  deleteMaterial, 
  getMaterialsByMineId,
  searchMaterials,
  
  // Unit management
  getStandardUnits,
  createCustomUnit,
  getUserCustomUnits,
  deleteCustomUnit,
  
  // Property management
  getCommonPropertySuggestions,
  createCustomProperty,
  getUserCustomProperties,
  deleteCustomProperty
} from '../controllers/materialController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Unit management routes
router.route('/units/standard').get(getStandardUnits);
router.route('/units/custom')
  .get(protect, authorizeRoles('mine_owner'), getUserCustomUnits)
  .post(protect, authorizeRoles('mine_owner'), createCustomUnit);
router.route('/units/custom/:id')
  .delete(protect, authorizeRoles('mine_owner'), deleteCustomUnit);

// Property management routes
router.route('/properties/suggestions').get(getCommonPropertySuggestions);
router.route('/properties/custom')
  .get(protect, authorizeRoles('mine_owner'), getUserCustomProperties)
  .post(protect, authorizeRoles('mine_owner'), createCustomProperty);
router.route('/properties/custom/:id')
  .delete(protect, authorizeRoles('mine_owner'), deleteCustomProperty);

// Material search
router.route('/search').get(searchMaterials);

// Main material routes
router.route('/')
  .get(getAllMaterials)
  .post(protect, authorizeRoles('mine_owner'), createMaterial);

// Materials by mine
router.route('/mine/:mine_id').get(getMaterialsByMineId);

// Individual material operations
router.route('/:id')
  .get(getMaterialById)
  .put(protect, authorizeRoles('mine_owner'), updateMaterial)
  .delete(protect, authorizeRoles('mine_owner'), deleteMaterial);

export default router;