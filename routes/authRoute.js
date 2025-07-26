import express from 'express';
import { registerUser, loginUser, checkUser, logoutUser, registerDriver } from '../controllers/authController.js';
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post('/check-user', checkUser);

router.post('/register-driver', protect, authorizeRoles('mine_owner, truck_owner'), registerDriver);

router.post('/register', registerUser);

router.post('/login', loginUser);

router.post('/logout', logoutUser);

export default router;