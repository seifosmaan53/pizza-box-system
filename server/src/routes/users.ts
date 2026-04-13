import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  deleteUser,
} from '../controllers/users';
import { authenticate, requireRole } from '../middleware/auth';
import { sensitiveWriteRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', sensitiveWriteRateLimiter, createUser);
router.put('/:id', updateUser);
router.patch('/:id/deactivate', deactivateUser);
router.patch('/:id/reactivate', reactivateUser);
router.delete('/:id', deleteUser);

export default router;
