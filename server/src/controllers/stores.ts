import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { createAuditLog, buildDiff } from '../utils/auditLog';
import { AppError } from '../middleware/errorHandler';

const storeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  contactName: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  zipCode: z.string().max(10).optional().nullable(),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  taxRate: z.number().min(0).max(100).default(0),
  defaultShippingFee: z.number().min(0).max(10000).default(0),
  notes: z.string().max(1000).optional().nullable(),
});

const updateStoreSchema = storeSchema.partial();

export async function getStores(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const where: Prisma.StoreWhereInput = {};

    if (req.query.isActive !== undefined) {
      where.isActive = req.query.isActive === 'true';
    }

    if (req.query.state) {
      where.state = String(req.query.state);
    }

    const stores = await prisma.store.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { invoices: true, inventoryItems: true },
        },
      },
    });

    res.json({ success: true, data: stores });
  } catch (err) {
    next(err);
  }
}

export async function getStoreById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await prisma.store.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { invoices: true, inventoryItems: true },
        },
      },
    });

    if (!store) throw new AppError('Store not found', 404, 'NOT_FOUND');

    res.json({ success: true, data: store });
  } catch (err) {
    next(err);
  }
}

export async function getStoreSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) throw new AppError('Store not found', 404, 'NOT_FOUND');

    const [inventoryItems, invoiceCounts, revenueResult, outstandingResult, lowStockItems] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { storeId: id },
        select: { quantity: true, lowStockThreshold: true },
      }),
      prisma.invoice.groupBy({
        by: ['status'],
        where: { storeId: id },
        _count: { id: true },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { storeId: id, status: 'PAID' },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: { storeId: id, status: { in: ['SENT', 'OVERDUE'] } },
        _sum: { total: true },
      }),
      prisma.inventoryItem.count({
        where: {
          storeId: id,
          quantity: { lte: prisma.inventoryItem.fields?.lowStockThreshold as any },
        },
      }).catch(() => 0),
    ]);

    const totalInventoryItems = inventoryItems.length;
    const totalBoxes = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockCount = inventoryItems.filter((item) => item.quantity <= item.lowStockThreshold).length;

    const invoiceCountsByStatus: Record<string, number> = {};
    let totalInvoices = 0;
    for (const group of invoiceCounts) {
      invoiceCountsByStatus[group.status] = group._count.id;
      totalInvoices += group._count.id;
    }

    const totalRevenue = Number(revenueResult._sum.total ?? 0);
    const outstandingAmount = Number(outstandingResult._sum.total ?? 0);

    res.json({
      success: true,
      data: {
        store: { id: store.id, name: store.name, currency: store.currency },
        totalInventoryItems,
        totalBoxes,
        lowStockCount,
        totalInvoices,
        totalRevenue,
        outstandingAmount,
        invoiceCounts: invoiceCountsByStatus,
        inventoryItemCount: totalInventoryItems,
        totalQuantity: totalBoxes,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = storeSchema.parse(req.body);

    const store = await prisma.store.create({ data });

    await createAuditLog({
      action: 'STORE_CREATED',
      entityType: 'Store',
      entityId: store.id,
      entityLabel: store.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { name: store.name },
    });

    res.status(201).json({ success: true, data: store });
  } catch (err) {
    next(err);
  }
}

export async function updateStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = updateStoreSchema.parse(req.body);

    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) throw new AppError('Store not found', 404, 'NOT_FOUND');

    const updated = await prisma.store.update({ where: { id }, data });

    const before = {
      name: existing.name,
      contactName: existing.contactName,
      email: existing.email,
      phone: existing.phone,
      address: existing.address,
      city: existing.city,
      state: existing.state,
      zipCode: existing.zipCode,
      taxRate: existing.taxRate,
      defaultShippingFee: existing.defaultShippingFee,
    };

    const after = {
      name: updated.name,
      contactName: updated.contactName,
      email: updated.email,
      phone: updated.phone,
      address: updated.address,
      city: updated.city,
      state: updated.state,
      zipCode: updated.zipCode,
      taxRate: updated.taxRate,
      defaultShippingFee: updated.defaultShippingFee,
    };

    await createAuditLog({
      action: 'STORE_UPDATED',
      entityType: 'Store',
      entityId: id,
      entityLabel: updated.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: buildDiff(before, after),
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deactivateStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) throw new AppError('Store not found', 404, 'NOT_FOUND');
    if (!existing.isActive) throw new AppError('Store is already inactive', 400, 'ALREADY_INACTIVE');

    const updated = await prisma.store.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      action: 'STORE_DEACTIVATED',
      entityType: 'Store',
      entityId: id,
      entityLabel: existing.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function reactivateStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) throw new AppError('Store not found', 404, 'NOT_FOUND');
    if (existing.isActive) throw new AppError('Store is already active', 400, 'ALREADY_ACTIVE');

    const updated = await prisma.store.update({
      where: { id },
      data: { isActive: true },
    });

    await createAuditLog({
      action: 'STORE_REACTIVATED',
      entityType: 'Store',
      entityId: id,
      entityLabel: existing.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.store.findUnique({ where: { id } });
    if (!existing) throw new AppError('Store not found', 404, 'NOT_FOUND');

    const [invoiceCount, inventoryCount, productStockCount] = await Promise.all([
      prisma.invoice.count({ where: { storeId: id } }),
      prisma.inventoryItem.count({ where: { storeId: id } }),
      prisma.productStock.count({ where: { storeId: id } }),
    ]);

    if (invoiceCount > 0 || inventoryCount > 0 || productStockCount > 0) {
      throw new AppError(
        'Cannot delete store with existing invoices, inventory items, or product stock. Remove them first or deactivate the store instead.',
        409,
        'CANNOT_DELETE_HAS_CHILDREN',
        { invoiceCount, inventoryCount, productStockCount }
      );
    }

    await prisma.store.delete({ where: { id } });

    res.json({ success: true, message: 'Store deleted successfully' });
  } catch (err) {
    next(err);
  }
}
