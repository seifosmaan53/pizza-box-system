import { Request, Response, NextFunction } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

async function buildSystemSnapshot(userId: string, role: string) {
  const [
    stores,
    inventoryItems,
    invoiceSummary,
    lowStockItems,
    recentInvoices,
    recentTransactions,
    settings,
  ] = await Promise.all([
    prisma.store.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { inventoryItems: true, invoices: true } },
        invoices: {
          where: { status: { in: ['DRAFT', 'SENT', 'OVERDUE', 'PAID'] } },
          select: { status: true, total: true },
        },
      },
    }),
    prisma.inventoryItem.findMany({
      include: {
        store: { select: { name: true } },
        boxType: { select: { name: true } },
        boxSize: { select: { name: true } },
      },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { total: true },
    }),
    Promise.resolve([]),
    prisma.invoice.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, invoiceNumber: true, status: true, total: true, currency: true,
        issueDate: true, dueDate: true, store: { select: { name: true } },
      },
    }),
    prisma.inventoryTransaction.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        inventoryItem: {
          include: {
            store: { select: { name: true } },
            boxType: { select: { name: true } },
            boxSize: { select: { name: true } },
          },
        },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: 'settings' } }),
  ]);

  // Compute low stock properly
  const lowStock = inventoryItems.filter((item) => item.quantity <= item.lowStockThreshold);

  // Warehouse inventory matrix
  const warehouseMap = new Map<string, { boxType: string; boxSize: string; totalQty: number; stores: Array<{ name: string; qty: number }> }>();
  for (const item of inventoryItems) {
    const key = `${item.boxType.name}|${item.boxSize.name}`;
    const existing = warehouseMap.get(key) || { boxType: item.boxType.name, boxSize: item.boxSize.name, totalQty: 0, stores: [] };
    existing.totalQty += item.quantity;
    existing.stores.push({ name: item.store.name, qty: item.quantity });
    warehouseMap.set(key, existing);
  }

  const totalWarehouseBoxes = inventoryItems.reduce((sum, i) => sum + i.quantity, 0);
  const openInvoices = invoiceSummary.filter((s) => ['SENT', 'OVERDUE'].includes(s.status));
  const openValue = openInvoices.reduce((sum, s) => sum + Number(s._sum.total || 0), 0);
  const overdueCount = invoiceSummary.find((s) => s.status === 'OVERDUE')?._count._all || 0;

  return {
    currentUser: { userId, role },
    companyName: settings?.companyName || 'Pizza Box Co',
    summary: {
      totalStores: stores.length,
      totalWarehouseBoxes,
      openInvoicesCount: openInvoices.reduce((sum, s) => sum + s._count._all, 0),
      openInvoicesValue: openValue,
      overdueInvoicesCount: overdueCount,
      lowStockItemsCount: lowStock.length,
    },
    stores: stores.map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      currency: s.currency,
      inventoryItems: s._count.inventoryItems,
      invoiceCounts: {
        draft: s.invoices.filter((i) => i.status === 'DRAFT').length,
        sent: s.invoices.filter((i) => i.status === 'SENT').length,
        paid: s.invoices.filter((i) => i.status === 'PAID').length,
        overdue: s.invoices.filter((i) => i.status === 'OVERDUE').length,
      },
    })),
    warehouseInventory: Array.from(warehouseMap.values()),
    lowStockItems: lowStock.map((i) => ({
      storeName: i.store.name,
      boxType: i.boxType.name,
      boxSize: i.boxSize.name,
      quantity: i.quantity,
      threshold: i.lowStockThreshold,
    })),
    recentInvoices: recentInvoices.map((i) => ({
      invoiceNumber: i.invoiceNumber,
      store: i.store.name,
      status: i.status,
      total: Number(i.total),
      currency: i.currency,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
    })),
    recentTransactions: recentTransactions.map((t) => ({
      type: t.type,
      storeName: t.inventoryItem?.store.name ?? '—',
      boxType: t.inventoryItem?.boxType.name ?? '—',
      boxSize: t.inventoryItem?.boxSize.name ?? '—',
      change: t.quantityChange,
      after: t.quantityAfter,
      note: t.note,
      date: t.createdAt,
    })),
  };
}

export async function getContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const snapshot = await buildSystemSnapshot(req.user!.userId, req.user!.role);
    res.json({ success: true, data: snapshot });
  } catch (err) {
    next(err);
  }
}

export async function chat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AppError('AI assistant is not configured. Set ANTHROPIC_API_KEY in your environment.', 503, 'INTERNAL_ERROR');
    }

    const { message, history, currentPage, currentContext } = req.body as {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      currentPage?: string;
      currentContext?: string;
    };
    if (!message?.trim()) throw new AppError('Message is required', 400, 'VALIDATION_ERROR');

    const snapshot = await buildSystemSnapshot(req.user!.userId, req.user!.role);

    const systemPrompt = `You are **Pizza Box AI**, the friendly and professional business assistant for "${snapshot.companyName}" — a pizza box inventory and invoicing management system.

## Your Personality
- Warm, helpful, and organized — like a knowledgeable colleague
- Use a clear structure in every response: headings, bullet points, and tables where appropriate
- Start responses with a brief, direct answer, then provide details
- Use bold for key numbers and important terms
- When listing data, prefer tables or neat bullet points over walls of text
- Keep responses concise but thorough — aim for clarity, not length
- Use section dividers (---) to separate distinct topics in longer responses

## Live Business Data
${JSON.stringify(snapshot, null, 2)}

${currentPage ? `📍 The user is currently viewing: ${currentPage}` : ''}
${currentContext ? `Context: ${currentContext}` : ''}

## Response Rules
1. **Always use real data** from the live snapshot above. Never invent numbers.
2. **Format with markdown**: headers (##), **bold**, bullet points, tables, and \`code\` for IDs/numbers.
3. **Be role-aware**: The user's role is **${req.user!.role}**. Don't suggest actions they can't perform (VIEWER = read-only).
4. **Lead with the answer**: Don't repeat the question back. Get to the point immediately.
5. **Use tables** for comparisons (e.g., store-by-store inventory, invoice breakdowns).
6. **Flag concerns proactively**: If you notice low stock, overdue invoices, or anomalies in the data, mention them.
7. **Be conversational**: End with a helpful follow-up suggestion when appropriate (e.g., "Would you like me to break this down by store?").`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:5173');

    // Build conversation messages with history for multi-turn context
    const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (history && Array.isArray(history)) {
      // Include up to last 8 messages for context (keep token usage reasonable)
      const recentHistory = history.slice(-8);
      for (const msg of recentHistory) {
        if (msg.role && msg.content && ['user', 'assistant'].includes(msg.role)) {
          conversationMessages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    conversationMessages.push({ role: 'user', content: message });

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: conversationMessages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    logger.error('AI chat error:', err);
    if (!res.headersSent) {
      next(err);
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
      res.end();
    }
  }
}
