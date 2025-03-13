import express from 'express';
import { registerUser, loginUser, checkUser, logoutUser } from '../controllers/authController.js';

const router = express.Router();

router.post('/check-user', checkUser);

router.post('/register', registerUser);

router.post('/login', loginUser);

router.post('/logout', logoutUser);

export default router;