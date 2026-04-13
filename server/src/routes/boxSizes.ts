import { Router } from 'express';
import {
  getBoxSizes,
  getBoxSizeById,
  createBoxSize,
  updateBoxSize,
  deactivateBoxSize,
  reactivateBoxSize,
  deleteBoxSize,
} from '../controllers/boxSizes';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getBoxSizes);
router.get('/:id', getBoxSizeById);
router.post('/', requireRole('ADMIN', 'MANAGER'), createBoxSize);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), updateBoxSize);
router.patch('/:id/deactivate', requireRole('ADMIN', 'MANAGER'), deactivateBoxSize);
router.patch('/:id/reactivate', requireRole('ADMIN', 'MANAGER'), reactivateBoxSize);
router.delete('/:id', requireRole('ADMIN'), deleteBoxSize);

export default router;
