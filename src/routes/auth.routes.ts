import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const authController = new AuthController();
export const authRoutes = Router();

authRoutes.post('/register', authController.register);
authRoutes.post('/login', authController.login);
authRoutes.post('/google', authController.googleLogin);
authRoutes.post('/forgot-password', authController.forgotPassword);
authRoutes.post('/reset-password', authController.resetPassword);
authRoutes.get('/api/auth/google/callback', authController.googleLogin);