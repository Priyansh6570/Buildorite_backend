import express from 'express';
import { createMaterial, getAllMaterials, getMaterialById, updateMaterial, deleteMaterial, getMaterialsByMineId } from '../controllers/materialController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(getAllMaterials).post(protect, authorizeRoles('mine_owner'), createMaterial);

router.route('/mine/:mine_id').get(getMaterialsByMineId);

router.route('/:id').get(getMaterialById).put(protect, authorizeRoles('mine_owner'), updateMaterial).delete(protect, authorizeRoles('mine_owner'), deleteMaterial);

export default router;