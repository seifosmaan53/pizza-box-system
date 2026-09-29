import { Router, type Router as ExpressRouter } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getAuditLog, getEntityAuditLog } from '../controllers/audit';

const router: ExpressRouter = Router();
router.use(authenticate, requireRole('ADMIN', 'MANAGER'));

router.get('/', getAuditLog);
router.get('/:entityType/:entityId', getEntityAuditLog);

export default router;
