import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getAuditLog, getEntityAuditLog } from '../controllers/audit';

const router = Router();
router.use(authenticate, requireRole('ADMIN', 'MANAGER'));

router.get('/', getAuditLog);
router.get('/:entityType/:entityId', getEntityAuditLog);

export default router;
