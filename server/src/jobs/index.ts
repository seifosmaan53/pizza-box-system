import cron from 'node-cron';
import logger from '../utils/logger';
import { markOverdueInvoices } from './overdueInvoices';
import { takeLowStockSnapshot } from './lowStockSnapshot';

export function startCronJobs(): void {
  // Every hour: detect overdue invoices
  cron.schedule('0 * * * *', async () => {
    logger.info('[CRON] Running overdue invoice detection...');
    try {
      await markOverdueInvoices();
    } catch (err) {
      logger.error('[CRON] Overdue detection failed:', err);
    }
  });

  // Daily at 6am UTC: low stock snapshot
  cron.schedule('0 6 * * *', async () => {
    logger.info('[CRON] Running low stock snapshot...');
    try {
      await takeLowStockSnapshot();
    } catch (err) {
      logger.error('[CRON] Low stock snapshot failed:', err);
    }
  });

  logger.info('Cron jobs scheduled: overdue (hourly), low-stock snapshot (6am UTC daily)');
}
