import { Router } from 'express';
import {
  getStores,
  getStoreById,
  getStoreSummary,
  createStore,
  updateStore,
  deactivateStore,
  reactivateStore,
  deleteStore,
} from '../controllers/stores';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getStores);
router.get('/:id', getStoreById);
router.get('/:id/summary', getStoreSummary);

router.post('/', requireRole('ADMIN', 'MANAGER'), createStore);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), updateStore);
router.patch('/:id/deactivate', requireRole('ADMIN', 'MANAGER'), deactivateStore);
router.patch('/:id/reactivate', requireRole('ADMIN', 'MANAGER'), reactivateStore);
router.delete('/:id', requireRole('ADMIN'), deleteStore);

export default router;
