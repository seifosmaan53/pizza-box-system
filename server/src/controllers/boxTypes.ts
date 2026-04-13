import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { createAuditLog, buildDiff } from '../utils/auditLog';
import { AppError } from '../middleware/errorHandler';

const boxTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().nullable(),
});

const updateBoxTypeSchema = boxTypeSchema.partial();

export async function getBoxTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const where: Record<string, unknown> = {};

    if (req.query.isActive !== undefined) {
      where.isActive = req.query.isActive === 'true';
    }

    const boxTypes = await prisma.boxType.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { inventoryItems: true } },
      },
    });

    res.json({ success: true, data: boxTypes });
  } catch (err) {
    next(err);
  }
}

export async function getBoxTypeById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const boxType = await prisma.boxType.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { inventoryItems: true } },
      },
    });

    if (!boxType) throw new AppError('Box type not found', 404, 'NOT_FOUND');

    res.json({ success: true, data: boxType });
  } catch (err) {
    next(err);
  }
}

export async function createBoxType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = boxTypeSchema.parse(req.body);

    const existing = await prisma.boxType.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError('A box type with this name already exists', 409, 'CONFLICT');

    const boxType = await prisma.boxType.create({ data });

    await createAuditLog({
      action: 'BOX_TYPE_CREATED',
      entityType: 'BoxType',
      entityId: boxType.id,
      entityLabel: boxType.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { name: boxType.name },
    });

    res.status(201).json({ success: true, data: boxType });
  } catch (err) {
    next(err);
  }
}

export async function updateBoxType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = updateBoxTypeSchema.parse(req.body);

    const existing = await prisma.boxType.findUnique({ where: { id } });
    if (!existing) throw new AppError('Box type not found', 404, 'NOT_FOUND');

    if (data.name && data.name !== existing.name) {
      const nameConflict = await prisma.boxType.findUnique({ where: { name: data.name } });
      if (nameConflict) throw new AppError('A box type with this name already exists', 409, 'CONFLICT');
    }

    const updated = await prisma.boxType.update({ where: { id }, data });

    await createAuditLog({
      action: 'BOX_TYPE_UPDATED',
      entityType: 'BoxType',
      entityId: id,
      entityLabel: updated.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: buildDiff(
        { name: existing.name, description: existing.description },
        { name: updated.name, description: updated.description }
      ),
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deactivateBoxType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.boxType.findUnique({ where: { id } });
    if (!existing) throw new AppError('Box type not found', 404, 'NOT_FOUND');
    if (!existing.isActive) throw new AppError('Box type is already inactive', 400, 'ALREADY_INACTIVE');

    const updated = await prisma.boxType.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      action: 'BOX_TYPE_DEACTIVATED',
      entityType: 'BoxType',
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

export async function reactivateBoxType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.boxType.findUnique({ where: { id } });
    if (!existing) throw new AppError('Box type not found', 404, 'NOT_FOUND');
    if (existing.isActive) throw new AppError('Box type is already active', 400, 'ALREADY_ACTIVE');
    const updated = await prisma.boxType.update({ where: { id }, data: { isActive: true } });
    await createAuditLog({ action: 'BOX_TYPE_REACTIVATED', entityType: 'BoxType', entityId: id, entityLabel: existing.name, userId: req.user!.userId, ipAddress: req.ip });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteBoxType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.boxType.findUnique({ where: { id } });
    if (!existing) throw new AppError('Box type not found', 404, 'NOT_FOUND');

    const force = req.query.force === 'true';

    const inventoryCount = await prisma.inventoryItem.count({ where: { boxTypeId: id } });
    const lineItemCount = await prisma.invoiceLineItem.count({
      where: { boxTypeSnapshot: existing.name },
    });

    if ((inventoryCount > 0 || lineItemCount > 0) && !force) {
      throw new AppError(
        'Cannot delete box type that is used in inventory items or invoices. Use force=true to cascade delete.',
        409,
        'CANNOT_DELETE_HAS_CHILDREN',
        { inventoryCount, lineItemCount }
      );
    }

    if (force && inventoryCount > 0) {
      // Get inventory item IDs for this box type
      const items = await prisma.inventoryItem.findMany({ where: { boxTypeId: id }, select: { id: true } });
      const itemIds = items.map((i) => i.id);

      // Delete related transactions, line items, then inventory items
      await prisma.inventoryTransaction.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await prisma.invoiceLineItem.deleteMany({ where: { inventoryItemId: { in: itemIds } } });
      await prisma.inventoryItem.deleteMany({ where: { boxTypeId: id } });
    }

    await prisma.boxType.delete({ where: { id } });

    res.json({ success: true, message: 'Box type deleted successfully' });
  } catch (err) {
    next(err);
  }
}
