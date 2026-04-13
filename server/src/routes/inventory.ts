import { Router } from 'express';
import multer from 'multer';
import {
  getInventory,
  getWarehouseView,
  getWarehouseDrilldown,
  getStoreInventory,
  getStoreProductStock,
  getLowStockItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  adjustInventory,
  adjustProductStockItem,
  deleteInventoryItem,
  bulkImport,
  getAllTransactions,
  getItemTransactions,
} from '../controllers/inventory';
import { authenticate, requireRole } from '../middleware/auth';
import { uploadRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

router.use(authenticate);

// Warehouse views
router.get('/warehouse', getWarehouseView);
router.get('/warehouse/drilldown/:boxTypeId/:boxSizeId', getWarehouseDrilldown);

// Low stock
router.get('/low-stock', getLowStockItems);

// Transactions
router.get('/transactions', getAllTransactions);
router.get('/:id/transactions', getItemTransactions);

// Store inventory
router.get('/store/:storeId', getStoreInventory);
router.get('/store/:storeId/products', getStoreProductStock);

// Product stock adjustment
router.patch('/product-stock/:id/adjust', requireRole('ADMIN', 'MANAGER'), adjustProductStockItem);

// Bulk import
router.post('/bulk-import', requireRole('ADMIN', 'MANAGER'), uploadRateLimiter, upload.single('file'), bulkImport);

// CRUD
router.get('/', getInventory);
router.get('/:id', getInventoryItem);
router.post('/', requireRole('ADMIN', 'MANAGER'), createInventoryItem);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), updateInventoryItem);
router.patch('/:id/adjust', requireRole('ADMIN', 'MANAGER'), adjustInventory);
router.delete('/:id', requireRole('ADMIN'), deleteInventoryItem);

export default router;
