import { Router } from 'express';
import { register, login, verify2FA, getProfile, updateProfile, toggle2FA, getUsers, getDashboardStats } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-2fa', verify2FA);

// Private routes
router.get('/users', authenticateToken, getUsers);
router.get('/profile/:id', authenticateToken, getProfile);
router.put('/profile/:id', authenticateToken, updateProfile);
router.post('/toggle-2fa', authenticateToken, toggle2FA);
router.get('/stats', authenticateToken, getDashboardStats);

export default router;
