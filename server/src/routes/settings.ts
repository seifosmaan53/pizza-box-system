import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { sensitiveWriteRateLimiter } from '../middleware/rateLimiter';
import { getSettings, updateSettings } from '../controllers/settings';

const router = Router();
router.use(authenticate);

router.get('/', getSettings);
router.put('/', requireRole('ADMIN'), sensitiveWriteRateLimiter, updateSettings);

export default router;
