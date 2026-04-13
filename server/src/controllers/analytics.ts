import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

function getDateRange(req: Request): { gte?: Date; lte?: Date } {
  const { startDate, endDate } = req.query;
  const range: { gte?: Date; lte?: Date } = {};
  if (startDate) range.gte = new Date(startDate as string);
  if (endDate) range.lte = new Date(endDate as string);
  return range;
}

function getCurrency(req: Request): string | undefined {
  const c = req.query.currency as string | undefined;
  return c && c !== 'ALL' ? c : undefined;
}

export async function getSalesByStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dateRange = getDateRange(req);
    const currency = getCurrency(req);
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PAID', 'SENT', 'OVERDUE'] },
        ...(currency ? { currency } : {}),
        ...(Object.keys(dateRange).length ? { issueDate: dateRange } : {}),
      },
      include: {
        store: { select: { id: true, name: true, currency: true } },
        lineItems: { select: { lineTotal: true, quantityOrdered: true } },
      },
    });

    const map = new Map<string, { storeId: string; storeName: string; currency: string; revenue: number; unitsSold: number; invoiceCount: number }>();
    for (const inv of invoices) {
      const existing = map.get(inv.storeId) || { storeId: inv.storeId, storeName: inv.store.name, currency: inv.store.currency, revenue: 0, unitsSold: 0, invoiceCount: 0 };
      existing.invoiceCount++;
      for (const li of inv.lineItems) {
        existing.revenue += Number(li.lineTotal);
        existing.unitsSold += li.quantityOrdered;
      }
      map.set(inv.storeId, existing);
    }

    res.json({ success: true, data: Array.from(map.values()).sort((a, b) => b.revenue - a.revenue) });
  } catch (err) { next(err); }
}

export async function getSalesByBoxType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dateRange = getDateRange(req);
    const currency = getCurrency(req);
    const lineItems = await prisma.invoiceLineItem.findMany({
      where: {
        boxTypeSnapshot: { not: '' },
        inventoryItemId: { not: null },
        invoice: {
          status: { in: ['PAID', 'SENT', 'OVERDUE'] },
          ...(currency ? { currency } : {}),
          ...(Object.keys(dateRange).length ? { issueDate: dateRange } : {}),
        },
      },
    });

    const map = new Map<string, { boxType: string; revenue: number; unitsSold: number }>();
    for (const li of lineItems) {
      if (!li.boxTypeSnapshot) continue;
      const existing = map.get(li.boxTypeSnapshot) || { boxType: li.boxTypeSnapshot, revenue: 0, unitsSold: 0 };
      existing.revenue += Number(li.lineTotal);
      existing.unitsSold += li.quantityOrdered;
      map.set(li.boxTypeSnapshot, existing);
    }

    res.json({ success: true, data: Array.from(map.values()).sort((a, b) => b.revenue - a.revenue) });
  } catch (err) { next(err); }
}

export async function getSalesByBoxSize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dateRange = getDateRange(req);
    const currency = getCurrency(req);
    const lineItems = await prisma.invoiceLineItem.findMany({
      where: {
        boxSizeSnapshot: { not: '' },
        inventoryItemId: { not: null },
        invoice: {
          status: { in: ['PAID', 'SENT', 'OVERDUE'] },
          ...(currency ? { currency } : {}),
          ...(Object.keys(dateRange).length ? { issueDate: dateRange } : {}),
        },
      },
    });

    const map = new Map<string, { boxSize: string; revenue: number; unitsSold: number }>();
    for (const li of lineItems) {
      if (!li.boxSizeSnapshot) continue;
      const existing = map.get(li.boxSizeSnapshot) || { boxSize: li.boxSizeSnapshot, revenue: 0, unitsSold: 0 };
      existing.revenue += Number(li.lineTotal);
      existing.unitsSold += li.quantityOrdered;
      map.set(li.boxSizeSnapshot, existing);
    }

    res.json({ success: true, data: Array.from(map.values()).sort((a, b) => b.revenue - a.revenue) });
  } catch (err) { next(err); }
}

export async function getRevenueOverTime(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dateRange = getDateRange(req);
    const groupBy = (req.query.groupBy as string) || 'month';
    const currency = getCurrency(req);
    const storeId = req.query.storeId as string | undefined;

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PAID', 'SENT', 'OVERDUE'] },
        ...(storeId ? { storeId } : {}),
        ...(currency ? { currency } : {}),
        ...(Object.keys(dateRange).length ? { issueDate: dateRange } : {}),
      },
      include: { lineItems: { select: { lineTotal: true, quantityOrdered: true } } },
      orderBy: { issueDate: 'asc' },
    });

    const map = new Map<string, { period: string; revenue: number; unitsSold: number }>();
    for (const inv of invoices) {
      const d = new Date(inv.issueDate);
      let period: string;
      if (groupBy === 'day') period = d.toISOString().slice(0, 10);
      else if (groupBy === 'week') {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        period = weekStart.toISOString().slice(0, 10);
      } else {
        period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      const existing = map.get(period) || { period, revenue: 0, unitsSold: 0 };
      for (const li of inv.lineItems) {
        existing.revenue += Number(li.lineTotal);
        existing.unitsSold += li.quantityOrdered;
      }
      map.set(period, existing);
    }

    res.json({ success: true, data: Array.from(map.values()) });
  } catch (err) { next(err); }
}

export async function getTopStores(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const dateRange = getDateRange(req);
    const currency = getCurrency(req);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PAID', 'SENT', 'OVERDUE'] },
        ...(currency ? { currency } : {}),
        ...(Object.keys(dateRange).length ? { issueDate: dateRange } : {}),
      },
      include: {
        store: { select: { id: true, name: true, state: true, currency: true } },
        lineItems: { select: { lineTotal: true, quantityOrdered: true } },
      },
      orderBy: { issueDate: 'desc' },
    });

    const map = new Map<string, { storeId: string; storeName: string; state: string; currency: string; revenue: number; unitsSold: number; invoiceCount: number; lastInvoiceDate: string }>();
    for (const inv of invoices) {
      const existing = map.get(inv.storeId) || {
        storeId: inv.storeId,
        storeName: inv.store.name,
        state: inv.store.state ?? '',
        currency: inv.store.currency,
        revenue: 0,
        unitsSold: 0,
        invoiceCount: 0,
        lastInvoiceDate: inv.issueDate.toISOString(),
      };
      existing.invoiceCount++;
      for (const li of inv.lineItems) {
        existing.revenue += Number(li.lineTotal);
        existing.unitsSold += li.quantityOrdered;
      }
      map.set(inv.storeId, existing);
    }

    const result = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

export async function getStoreAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId } = req.params;
    const invoices = await prisma.invoice.findMany({
      where: { storeId, status: { in: ['PAID', 'SENT', 'OVERDUE'] } },
      include: { lineItems: true },
      orderBy: { issueDate: 'desc' },
    });

    const monthly = new Map<string, { period: string; revenue: number; unitsSold: number }>();
    const byType = new Map<string, { boxType: string; unitsSold: number; revenue: number }>();
    const bySize = new Map<string, { boxSize: string; unitsSold: number; revenue: number }>();

    for (const inv of invoices) {
      const d = new Date(inv.issueDate);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const m = monthly.get(period) || { period, revenue: 0, unitsSold: 0 };
      for (const li of inv.lineItems) {
        m.revenue += Number(li.lineTotal);
        m.unitsSold += li.quantityOrdered;
        const t = byType.get(li.boxTypeSnapshot) || { boxType: li.boxTypeSnapshot, unitsSold: 0, revenue: 0 };
        t.unitsSold += li.quantityOrdered;
        t.revenue += Number(li.lineTotal);
        byType.set(li.boxTypeSnapshot, t);
        const s = bySize.get(li.boxSizeSnapshot) || { boxSize: li.boxSizeSnapshot, unitsSold: 0, revenue: 0 };
        s.unitsSold += li.quantityOrdered;
        s.revenue += Number(li.lineTotal);
        bySize.set(li.boxSizeSnapshot, s);
      }
      monthly.set(period, m);
    }

    res.json({
      success: true,
      data: {
        monthly: Array.from(monthly.values()),
        byBoxType: Array.from(byType.values()).sort((a, b) => b.unitsSold - a.unitsSold),
        byBoxSize: Array.from(bySize.values()).sort((a, b) => b.unitsSold - a.unitsSold),
        totalInvoices: invoices.length,
        totalRevenue: invoices.reduce((sum, inv) => sum + Number(inv.total), 0),
      },
    });
  } catch (err) { next(err); }
}

export async function getInventorySnapshot(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const items = await prisma.inventoryItem.findMany({
      include: {
        boxType: { select: { name: true } },
        boxSize: { select: { name: true, sortOrder: true } },
        inventoryTransactions: {
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { quantityChange: true },
        },
      },
      orderBy: [{ boxType: { name: 'asc' } }, { boxSize: { sortOrder: 'asc' } }],
    });

    const boxResult = items.map((item) => ({
      id: item.id,
      kind: 'box' as const,
      boxType: item.boxType.name,
      boxSize: item.boxSize.name,
      currentQty: item.quantity,
      qtyChange30d: item.inventoryTransactions.reduce((sum, t) => sum + t.quantityChange, 0),
      lowStockThreshold: item.lowStockThreshold,
      isLowStock: item.quantity <= item.lowStockThreshold,
    }));

    // Also include product stock
    const productStockItems = await prisma.productStock.findMany({
      where: { product: { isActive: true } },
      include: {
        product: { select: { name: true } },
        transactions: {
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { quantityChange: true },
        },
      },
      orderBy: { product: { name: 'asc' } },
    });

    const productResult = productStockItems.map((ps) => ({
      id: ps.id,
      kind: 'product' as const,
      boxType: ps.product.name,
      boxSize: 'Product',
      currentQty: ps.quantity,
      qtyChange30d: ps.transactions.reduce((sum, t) => sum + t.quantityChange, 0),
      lowStockThreshold: ps.lowStockThreshold,
      isLowStock: ps.quantity <= ps.lowStockThreshold,
    }));

    res.json({ success: true, data: [...boxResult, ...productResult] });
  } catch (err) { next(err); }
}

export async function getInvoiceSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const statuses = ['DRAFT', 'SENT', 'PAID', 'CANCELLED', 'OVERDUE'] as const;
    const summary: Record<string, { count: number; value: number }> = {};

    for (const status of statuses) {
      const invoices = await prisma.invoice.findMany({
        where: { status },
        select: { total: true },
      });
      summary[status] = {
        count: invoices.length,
        value: invoices.reduce((sum, inv) => sum + Number(inv.total), 0),
      };
    }

    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
}
