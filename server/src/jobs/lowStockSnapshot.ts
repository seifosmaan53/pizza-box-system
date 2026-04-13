import prisma from '../lib/prisma';
import logger from '../utils/logger';

export async function takeLowStockSnapshot(): Promise<void> {
  const items = await prisma.inventoryItem.findMany({
    include: {
      store: { select: { name: true } },
      boxType: { select: { name: true } },
      boxSize: { select: { name: true } },
    },
  });

  const lowStockItems = items.filter((item) => item.quantity <= item.lowStockThreshold);

  if (lowStockItems.length === 0) {
    logger.info('[CRON] Low stock snapshot: no items below threshold');
    return;
  }

  const systemUser = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });

  if (!systemUser) {
    logger.warn('[CRON] No admin user found for low stock snapshot');
    return;
  }

  const summary = lowStockItems.map((item) => ({
    store: item.store.name,
    boxType: item.boxType.name,
    boxSize: item.boxSize.name,
    quantity: item.quantity,
    threshold: item.lowStockThreshold,
    deficit: item.lowStockThreshold - item.quantity,
  }));

  await prisma.auditLog.create({
    data: {
      action: 'LOW_STOCK_SNAPSHOT',
      entityType: 'InventoryItem',
      entityId: 'snapshot',
      entityLabel: `Daily Low Stock Snapshot — ${lowStockItems.length} item(s) below threshold`,
      userId: systemUser.id,
      changeDetails: {
        snapshotDate: new Date().toISOString(),
        lowStockCount: lowStockItems.length,
        items: summary,
      },
    },
  });

  logger.info(`[CRON] Low stock snapshot: ${lowStockItems.length} item(s) below threshold`);
}
