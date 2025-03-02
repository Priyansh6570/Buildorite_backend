import express from 'express';
import { refreshAccessToken, registerUser, loginUser, checkUser, logoutUser } from '../controllers/authController.js';

const router = express.Router();

router.post('/refresh-token', refreshAccessToken);

router.post('/check-user', checkUser);

router.post('/register', registerUser);

router.post('/login', loginUser);

router.post('/logout', logoutUser);

export default router;