import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export interface CreateAuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  userId: string;
  ipAddress?: string;
  changeDetails?: Record<string, unknown>;
  invoiceId?: string;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      userId: params.userId,
      ipAddress: params.ipAddress || null,
      changeDetails: (params.changeDetails || {}) as Prisma.InputJsonValue,
      invoiceId: params.invoiceId || null,
    },
  });
}

export function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = { before: before[key], after: after[key] };
    }
  }

  return diff;
}
