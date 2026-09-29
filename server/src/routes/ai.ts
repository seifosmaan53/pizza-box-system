import { Router, type Router as ExpressRouter } from 'express';
import { authenticate } from '../middleware/auth';
import { chat, getContext } from '../controllers/ai';

const router: ExpressRouter = Router();
router.use(authenticate);

router.post('/chat', chat);
router.get('/context', getContext);

export default router;
