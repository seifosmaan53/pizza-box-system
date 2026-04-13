import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { sendOverdueReminderEmail } from '../utils/email';

export async function markOverdueInvoices(): Promise<void> {
  const now = new Date();

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: 'SENT',
      dueDate: { lt: now },
    },
    include: { store: { select: { name: true, email: true, contactName: true } } },
  });

  if (overdueInvoices.length === 0) {
    logger.info('[CRON] No new overdue invoices found');
    return;
  }

  // Get any admin user to attribute system actions
  const systemUser = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });

  const userId = systemUser?.id;
  if (!userId) {
    logger.warn('[CRON] No admin user found to attribute overdue actions');
    return;
  }

  for (const invoice of overdueInvoices) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' },
      });

      await tx.auditLog.create({
        data: {
          action: 'AUTO_MARK_OVERDUE',
          entityType: 'Invoice',
          entityId: invoice.id,
          entityLabel: invoice.invoiceNumber,
          userId,
          changeDetails: { statusChange: 'SENT → OVERDUE', triggeredBy: 'system_cron', timestamp: now.toISOString() },
          invoiceId: invoice.id,
        },
      });
    });

    logger.info(`[CRON] Marked invoice ${invoice.invoiceNumber} as OVERDUE`);

    // Send overdue reminder email
    if (invoice.store.email) {
      const daysOverdue = Math.ceil((now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      sendOverdueReminderEmail(invoice.store.email, {
        invoiceNumber: invoice.invoiceNumber,
        storeName: invoice.store.name,
        contactName: invoice.store.contactName ?? invoice.store.name,
        total: Number(invoice.total).toFixed(2),
        dueDate: new Date(invoice.dueDate).toLocaleDateString('en-US'),
        daysOverdue,
      }).catch(() => {});
    }
  }

  logger.info(`[CRON] Marked ${overdueInvoices.length} invoice(s) as OVERDUE`);
}
