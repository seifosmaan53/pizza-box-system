import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as products from '../controllers/products';

const router = Router();
router.use(authenticate);

router.get('/', products.getProducts);
router.get('/:id', products.getProduct);
router.post('/', requireRole('ADMIN', 'MANAGER'), products.createProduct);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), products.updateProduct);
router.patch('/:id/deactivate', requireRole('ADMIN', 'MANAGER'), products.deactivateProduct);
router.patch('/:id/reactivate', requireRole('ADMIN', 'MANAGER'), products.reactivateProduct);
router.delete('/:id', requireRole('ADMIN'), products.deleteProduct);
router.get('/:id/stock', products.getProductStock);
router.post('/:id/stock', requireRole('ADMIN', 'MANAGER'), products.setProductStock);
router.patch('/:id/stock/adjust', requireRole('ADMIN', 'MANAGER'), products.adjustProductStock);

export default router;
