import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getInvoices,
  getNextNumber,
  getInvoiceById,
  downloadPDF,
  createInvoice,
  updateInvoice,
  sendInvoice,
  payInvoice,
  cancelInvoice,
  markOverdue,
  deleteInvoice,
} from '../controllers/invoices';

const router = Router();
router.use(authenticate);

router.get('/', getInvoices);
router.get('/next-number', getNextNumber);
router.get('/:id', getInvoiceById);
router.get('/:id/pdf', downloadPDF);
router.post('/', requireRole('ADMIN', 'MANAGER'), createInvoice);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), updateInvoice);
router.patch('/:id/send', requireRole('ADMIN', 'MANAGER'), sendInvoice);
router.patch('/:id/pay', requireRole('ADMIN', 'MANAGER'), payInvoice);
router.patch('/:id/cancel', requireRole('ADMIN', 'MANAGER'), cancelInvoice);
router.patch('/:id/mark-overdue', requireRole('ADMIN', 'MANAGER'), markOverdue);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), deleteInvoice);

export default router;
