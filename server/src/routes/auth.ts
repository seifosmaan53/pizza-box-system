import { Router, type Router as ExpressRouter } from 'express';
import {
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getMe,
  changePassword,
  updateProfile,
} from '../controllers/auth';
import { authenticate, optionalAuth } from '../middleware/auth';
import {
  loginRateLimiter,
  refreshRateLimiter,
  forgotPasswordRateLimiter,
} from '../middleware/rateLimiter';

const router: ExpressRouter = Router();

router.post('/login', loginRateLimiter, login);
router.post('/refresh', refreshRateLimiter, refresh);
router.post('/logout', optionalAuth, logout);
router.post('/forgot-password', forgotPasswordRateLimiter, forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);
router.put('/profile', authenticate, updateProfile);

export default router;
