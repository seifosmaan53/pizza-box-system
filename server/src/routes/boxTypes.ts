import { Router } from 'express';
import {
  getBoxTypes,
  getBoxTypeById,
  createBoxType,
  updateBoxType,
  deactivateBoxType,
  reactivateBoxType,
  deleteBoxType,
} from '../controllers/boxTypes';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getBoxTypes);
router.get('/:id', getBoxTypeById);
router.post('/', requireRole('ADMIN', 'MANAGER'), createBoxType);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), updateBoxType);
router.patch('/:id/deactivate', requireRole('ADMIN', 'MANAGER'), deactivateBoxType);
router.patch('/:id/reactivate', requireRole('ADMIN', 'MANAGER'), reactivateBoxType);
router.delete('/:id', requireRole('ADMIN'), deleteBoxType);

export default router;
