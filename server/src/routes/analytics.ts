import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSalesByStore,
  getSalesByBoxType,
  getSalesByBoxSize,
  getRevenueOverTime,
  getTopStores,
  getStoreAnalytics,
  getInventorySnapshot,
  getInvoiceSummary,
} from '../controllers/analytics';

const router = Router();
router.use(authenticate);

router.get('/sales-by-store', getSalesByStore);
router.get('/sales-by-box-type', getSalesByBoxType);
router.get('/sales-by-box-size', getSalesByBoxSize);
router.get('/revenue-over-time', getRevenueOverTime);
router.get('/top-stores', getTopStores);
router.get('/store/:storeId', getStoreAnalytics);
router.get('/inventory-snapshot', getInventorySnapshot);
router.get('/invoice-summary', getInvoiceSummary);

export default router;
