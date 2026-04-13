import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { createAuditLog, buildDiff } from '../utils/auditLog';
import { AppError } from '../middleware/errorHandler';

const boxSizeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  dimensions: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

const updateBoxSizeSchema = boxSizeSchema.partial();

export async function getBoxSizes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const where: Record<string, unknown> = {};

    if (req.query.isActive !== undefined) {
      where.isActive = req.query.isActive === 'true';
    }

    const boxSizes = await prisma.boxSize.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { inventoryItems: true } },
      },
    });

    res.json({ success: true, data: boxSizes });
  } catch (err) {
    next(err);
  }
}

export async function getBoxSizeById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const boxSize = await prisma.boxSize.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { inventoryItems: true } },
      },
    });

    if (!boxSize) throw new AppError('Box size not found', 404, 'NOT_FOUND');

    res.json({ success: true, data: boxSize });
  } catch (err) {
    next(err);
  }
}

export async function createBoxSize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = boxSizeSchema.parse(req.body);

    const existing = await prisma.boxSize.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError('A box size with this name already exists', 409, 'CONFLICT');

    const boxSize = await prisma.boxSize.create({ data });

    await createAuditLog({
      action: 'BOX_SIZE_CREATED',
      entityType: 'BoxSize',
      entityId: boxSize.id,
      entityLabel: boxSize.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { name: boxSize.name, sortOrder: boxSize.sortOrder },
    });

    res.status(201).json({ success: true, data: boxSize });
  } catch (err) {
    next(err);
  }
}

export async function updateBoxSize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = updateBoxSizeSchema.parse(req.body);

    const existing = await prisma.boxSize.findUnique({ where: { id } });
    if (!existing) throw new AppError('Box size not found', 404, 'NOT_FOUND');

    if (data.name && data.name !== existing.name) {
      const nameConflict = await prisma.boxSize.findUnique({ where: { name: data.name } });
      if (nameConflict) throw new AppError('A box size with this name already exists', 409, 'CONFLICT');
    }

    const updated = await prisma.boxSize.update({ where: { id }, data });

    await createAuditLog({
      action: 'BOX_SIZE_UPDATED',
      entityType: 'BoxSize',
      entityId: id,
      entityLabel: updated.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: buildDiff(
        { name: existing.name, dimensions: existing.dimensions, sortOrder: existing.sortOrder },
        { name: updated.name, dimensions: updated.dimensions, sortOrder: updated.sortOrder }
      ),
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deactivateBoxSize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.boxSize.findUnique({ where: { id } });
    if (!existing) throw new AppError('Box size not found', 404, 'NOT_FOUND');
    if (!existing.isActive) throw new AppError('Box size is already inactive', 400, 'ALREADY_INACTIVE');

    const updated = await prisma.boxSize.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      action: 'BOX_SIZE_DEACTIVATED',
      entityType: 'BoxSize',
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

export async function reactivateBoxSize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.boxSize.findUnique({ where: { id } });
    if (!existing) throw new AppError('Box size not found', 404, 'NOT_FOUND');
    if (existing.isActive) throw new AppError('Box size is already active', 400, 'ALREADY_ACTIVE');
    const updated = await prisma.boxSize.update({ where: { id }, data: { isActive: true } });
    await createAuditLog({ action: 'BOX_SIZE_REACTIVATED', entityType: 'BoxSize', entityId: id, entityLabel: existing.name, userId: req.user!.userId, ipAddress: req.ip });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteBoxSize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.boxSize.findUnique({ where: { id } });
    if (!existing) throw new AppError('Box size not found', 404, 'NOT_FOUND');

    const force = req.query.force === 'true';

    const inventoryCount = await prisma.inventoryItem.count({ where: { boxSizeId: id } });
    const lineItemCount = await prisma.invoiceLineItem.count({
      where: { boxSizeSnapshot: existing.name },
    });

    if ((inventoryCount > 0 || lineItemCount > 0) && !force) {
      throw new AppError(
        'Cannot delete box size that is used in inventory items or invoices. Use force=true to cascade delete.',
        409,
        'CANNOT_DELETE_HAS_CHILDREN',
        { inventoryCount, lineItemCount }
      );
    }

    if (force && inventoryCount > 0) {
      const items = await prisma.inventoryItem.findMany({ where: { boxSizeId: id }, select: { id: true } });
      const itemIds = items.map((i) => i.id);

      await prisma.inventoryTransaction.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await prisma.invoiceLineItem.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await prisma.inventoryItem.deleteMany({ where: { boxSizeId: id } });
    }

    await prisma.boxSize.delete({ where: { id } });

    res.json({ success: true, message: 'Box size deleted successfully' });
  } catch (err) {
    next(err);
  }
}
