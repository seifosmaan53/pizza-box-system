import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { createAuditLog } from '../utils/auditLog';

const updateSettingsSchema = z.object({
  companyName: z.string().min(1).optional(),
  logoUrl: z.string().url().optional().nullable(),
  defaultCurrency: z.string().length(3).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  invoicePrefix: z.string().min(1).max(10).optional(),
  lowStockGlobal: z.number().int().min(0).max(10000).optional(),
});

export async function getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await prisma.appSettings.upsert({
      where: { id: 'settings' },
      create: { id: 'settings', companyName: 'Pizza Box Co', defaultCurrency: 'USD', defaultTaxRate: 0, invoicePrefix: 'INV', lowStockGlobal: 20 },
      update: {},
    });
    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = updateSettingsSchema.parse(req.body);
    const userId = req.user!.userId;

    const existing = await prisma.appSettings.findUnique({ where: { id: 'settings' } });

    const settings = await prisma.appSettings.upsert({
      where: { id: 'settings' },
      create: { id: 'settings', ...body },
      update: body,
    });

    await createAuditLog({
      action: 'UPDATE_SETTINGS',
      entityType: 'AppSettings',
      entityId: 'settings',
      entityLabel: 'Company Settings',
      userId,
      ipAddress: req.ip,
      changeDetails: { before: existing || {}, after: body },
    });

    res.json({ success: true, data: settings });
  } catch (err) { next(err); }
}
