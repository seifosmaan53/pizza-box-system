import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export async function getAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, entityType, action, startDate, endDate, page = '1', pageSize = '25' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = Math.min(parseInt(pageSize as string, 10), 100);
    const skip = (pageNum - 1) * pageSizeNum;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = { contains: action as string, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: pageSizeNum,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { total, page: pageNum, pageSize: pageSizeNum, totalPages: Math.ceil(total / pageSizeNum) },
    });
  } catch (err) { next(err); }
}

export async function getEntityAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { entityType, entityId } = req.params;
    const logs = await prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
}
