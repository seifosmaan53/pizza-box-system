import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import puppeteer from 'puppeteer';
import prisma from '../lib/prisma';
import { generateInvoiceNumber, peekNextInvoiceNumber } from '../utils/invoiceNumber';
import { createAuditLog } from '../utils/auditLog';
import { AppError } from '../middleware/errorHandler';
import { sendInvoiceEmail, sendInvoicePaidEmail } from '../utils/email';

const lineItemSchema = z.object({
  inventoryItemId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  description: z.string().optional(),
  quantityOrdered: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().positive().optional(),
}).refine((d) => d.inventoryItemId || d.productId || d.description, {
  message: 'Each line item needs an inventoryItemId, productId, or description',
});

const createInvoiceSchema = z.object({
  storeId: z.string().uuid(),
  issueDate: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }).optional(),
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  notes: z.string().max(1000).optional().nullable(),
  internalNotes: z.string().max(1000).optional().nullable(),
  applyTax: z.boolean().default(true),
  shippingFee: z.number().min(0).default(0),
});

const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  dueDate: z.string().refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' }).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

export async function getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};

    if (req.query.storeId) where.storeId = String(req.query.storeId);

    if (req.query.status) {
      const statuses = Array.isArray(req.query.status)
        ? (req.query.status as string[])
        : [String(req.query.status)];
      where.status = { in: statuses as Prisma.EnumInvoiceStatusFilter['in'] };
    }

    if (req.query.overdueOnly === 'true') {
      where.status = 'OVERDUE';
    }

    if (req.query.startDate || req.query.endDate) {
      where.issueDate = {};
      if (req.query.startDate) {
        (where.issueDate as Prisma.DateTimeFilter).gte = new Date(String(req.query.startDate));
      }
      if (req.query.endDate) {
        (where.issueDate as Prisma.DateTimeFilter).lte = new Date(String(req.query.endDate));
      }
    }

    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { store: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issueDate: 'desc' },
        include: {
          store: { select: { id: true, name: true, currency: true } },
          createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: { select: { lineItems: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getNextNumber(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const nextNumber = await peekNextInvoiceNumber();
    res.json({ success: true, data: { nextNumber } });
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        store: true,
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        lineItems: {
          include: {
            inventoryItem: {
              include: {
                boxType: { select: { id: true, name: true } },
                boxSize: { select: { id: true, name: true } },
              },
            },
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = createInvoiceSchema.parse(req.body);

    const store = await prisma.store.findUnique({ where: { id: body.storeId } });
    if (!store) throw new AppError('Store not found', 404, 'NOT_FOUND');
    if (!store.isActive) throw new AppError('Store is not active', 400, 'STORE_INACTIVE');

    // Validate each line item
    const errors: string[] = [];
    const lineItemData: Array<{
      inventoryItemId?: string;
      productId?: string;
      description: string;
      quantityOrdered: number;
      unitPrice: Decimal;
      boxTypeSnapshot: string;
      boxSizeSnapshot: string;
    }> = [];

    for (const li of body.lineItems) {
      if (li.inventoryItemId) {
        const item = await prisma.inventoryItem.findUnique({
          where: { id: li.inventoryItemId },
          include: { boxType: true, boxSize: true },
        });

        if (!item) {
          errors.push(`Inventory item ${li.inventoryItemId} not found`);
          continue;
        }

        if (item.storeId !== body.storeId) {
          errors.push(`Inventory item ${li.inventoryItemId} does not belong to this store`);
          continue;
        }

        if (item.quantity < li.quantityOrdered) {
          errors.push(
            `Insufficient stock for ${item.boxType.name} ${item.boxSize.name}: available ${item.quantity}, requested ${li.quantityOrdered}`
          );
          continue;
        }

        lineItemData.push({
          inventoryItemId: li.inventoryItemId,
          description: `${item.boxType.name} ${item.boxSize.name}`,
          quantityOrdered: li.quantityOrdered,
          unitPrice: li.unitPrice !== undefined
            ? new Decimal(li.unitPrice)
            : new Decimal(item.pricePerUnit.toString()),
          boxTypeSnapshot: item.boxType.name,
          boxSizeSnapshot: item.boxSize.name,
        });
      } else if (li.productId) {
        const product = await prisma.product.findUnique({ where: { id: li.productId } });

        if (!product) {
          errors.push(`Product ${li.productId} not found`);
          continue;
        }

        if (!product.isActive) {
          errors.push(`Product "${product.name}" is not active`);
          continue;
        }

        if (li.unitPrice === undefined) {
          errors.push(`Unit price is required for product "${product.name}"`);
          continue;
        }

        // Check ProductStock (warn but don't block)
        const stock = await prisma.productStock.findUnique({
          where: { productId_storeId: { productId: li.productId, storeId: body.storeId } },
        });
        if (stock && stock.quantity < li.quantityOrdered) {
          // Just a warning - products may be restocked
        }

        lineItemData.push({
          productId: li.productId,
          description: product.name,
          quantityOrdered: li.quantityOrdered,
          unitPrice: new Decimal(li.unitPrice),
          boxTypeSnapshot: '',
          boxSizeSnapshot: '',
        });
      } else if (li.description) {
        if (li.unitPrice === undefined) {
          errors.push(`Unit price is required for custom line item "${li.description}"`);
          continue;
        }

        lineItemData.push({
          description: li.description,
          quantityOrdered: li.quantityOrdered,
          unitPrice: new Decimal(li.unitPrice),
          boxTypeSnapshot: '',
          boxSizeSnapshot: '',
        });
      }
    }

    if (errors.length > 0) {
      throw new AppError('Line item validation failed', 400, 'LINE_ITEM_VALIDATION_ERROR', errors);
    }

    // Calculate totals
    let subtotal = new Decimal(0);
    for (const li of lineItemData) {
      subtotal = subtotal.plus(li.unitPrice.times(li.quantityOrdered));
    }
    const effectiveTaxRate = body.applyTax !== false ? store.taxRate : 0;
    const taxAmount = subtotal.times(effectiveTaxRate).dividedBy(100);
    const shippingFee = new Decimal(body.shippingFee ?? 0);
    const total = subtotal.plus(taxAmount).plus(shippingFee);

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          storeId: body.storeId,
          status: 'DRAFT',
          issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
          dueDate: new Date(body.dueDate),
          currency: store.currency,
          taxRate: effectiveTaxRate,
          subtotal: subtotal.toDecimalPlaces(2).toString(),
          taxAmount: taxAmount.toDecimalPlaces(2).toString(),
          shippingFee: shippingFee.toDecimalPlaces(2).toString(),
          total: total.toDecimalPlaces(2).toString(),
          notes: body.notes || null,
          internalNotes: body.internalNotes || null,
          createdById: req.user!.userId,
          lineItems: {
            create: lineItemData.map((li) => ({
              ...(li.inventoryItemId && { inventoryItemId: li.inventoryItemId }),
              ...(li.productId && { productId: li.productId }),
              description: li.description,
              boxTypeSnapshot: li.boxTypeSnapshot,
              boxSizeSnapshot: li.boxSizeSnapshot,
              quantityOrdered: li.quantityOrdered,
              unitPrice: li.unitPrice.toDecimalPlaces(2).toString(),
              lineTotal: li.unitPrice.times(li.quantityOrdered).toDecimalPlaces(2).toString(),
            })),
          },
        },
        include: {
          store: { select: { id: true, name: true } },
          lineItems: true,
        },
      });

      return created;
    });

    await createAuditLog({
      action: 'INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      userId: req.user!.userId,
      ipAddress: req.ip,
      invoiceId: invoice.id,
      changeDetails: { status: 'DRAFT', total: total.toString() },
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function updateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const body = updateInvoiceSchema.parse(req.body);

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { store: true, lineItems: true },
    });

    if (!existing) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

    if (existing.status !== 'DRAFT') {
      throw new AppError(
        'Only DRAFT invoices can be updated',
        400,
        'INVOICE_STATUS_INVALID_TRANSITION'
      );
    }

    const store = body.storeId
      ? await prisma.store.findUnique({ where: { id: body.storeId } })
      : existing.store;

    if (!store) throw new AppError('Store not found', 404, 'NOT_FOUND');

    const lineItemData: Array<{
      inventoryItemId?: string;
      productId?: string;
      description: string;
      quantityOrdered: number;
      unitPrice: Decimal;
      boxTypeSnapshot: string;
      boxSizeSnapshot: string;
    }> = [];

    if (body.lineItems) {
      const errors: string[] = [];
      const effectiveStoreId = body.storeId || existing.storeId;

      for (const li of body.lineItems) {
        if (li.inventoryItemId) {
          const item = await prisma.inventoryItem.findUnique({
            where: { id: li.inventoryItemId },
            include: { boxType: true, boxSize: true },
          });

          if (!item) {
            errors.push(`Inventory item ${li.inventoryItemId} not found`);
            continue;
          }

          if (item.storeId !== effectiveStoreId) {
            errors.push(`Inventory item ${li.inventoryItemId} does not belong to this store`);
            continue;
          }

          if (item.quantity < li.quantityOrdered) {
            errors.push(
              `Insufficient stock for ${item.boxType.name} ${item.boxSize.name}: available ${item.quantity}, requested ${li.quantityOrdered}`
            );
            continue;
          }

          lineItemData.push({
            inventoryItemId: li.inventoryItemId,
            description: `${item.boxType.name} ${item.boxSize.name}`,
            quantityOrdered: li.quantityOrdered,
            unitPrice: li.unitPrice !== undefined
              ? new Decimal(li.unitPrice)
              : new Decimal(item.pricePerUnit.toString()),
            boxTypeSnapshot: item.boxType.name,
            boxSizeSnapshot: item.boxSize.name,
          });
        } else if (li.productId) {
          const product = await prisma.product.findUnique({ where: { id: li.productId } });

          if (!product) {
            errors.push(`Product ${li.productId} not found`);
            continue;
          }

          if (!product.isActive) {
            errors.push(`Product "${product.name}" is not active`);
            continue;
          }

          if (li.unitPrice === undefined) {
            errors.push(`Unit price is required for product "${product.name}"`);
            continue;
          }

          lineItemData.push({
            productId: li.productId,
            description: product.name,
            quantityOrdered: li.quantityOrdered,
            unitPrice: new Decimal(li.unitPrice),
            boxTypeSnapshot: '',
            boxSizeSnapshot: '',
          });
        } else if (li.description) {
          if (li.unitPrice === undefined) {
            errors.push(`Unit price is required for custom line item "${li.description}"`);
            continue;
          }

          lineItemData.push({
            description: li.description,
            quantityOrdered: li.quantityOrdered,
            unitPrice: new Decimal(li.unitPrice),
            boxTypeSnapshot: '',
            boxSizeSnapshot: '',
          });
        }
      }

      if (errors.length > 0) {
        throw new AppError('Line item validation failed', 400, 'LINE_ITEM_VALIDATION_ERROR', errors);
      }
    }

    let subtotal = new Decimal(0);
    const finalLineItems = lineItemData.length > 0 ? lineItemData : [];

    if (finalLineItems.length > 0) {
      for (const li of finalLineItems) {
        subtotal = subtotal.plus(li.unitPrice.times(li.quantityOrdered));
      }
    } else {
      subtotal = new Decimal(existing.subtotal.toString());
    }

    const effectiveTaxRate = body.applyTax !== undefined
      ? (body.applyTax ? store.taxRate : 0)
      : existing.taxRate;
    const taxAmount = subtotal.times(effectiveTaxRate).dividedBy(100);
    const shippingFee = new Decimal(
      body.shippingFee !== undefined ? body.shippingFee : existing.shippingFee.toString()
    );
    const total = subtotal.plus(taxAmount).plus(shippingFee);

    const updated = await prisma.$transaction(async (tx) => {
      if (finalLineItems.length > 0) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          ...(body.storeId && { storeId: body.storeId }),
          ...(body.dueDate && { dueDate: new Date(body.dueDate) }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.internalNotes !== undefined && { internalNotes: body.internalNotes }),
          ...(body.shippingFee !== undefined && { shippingFee: shippingFee.toDecimalPlaces(2).toString() }),
          ...(finalLineItems.length > 0 && {
            currency: store.currency,
            taxRate: effectiveTaxRate,
            subtotal: subtotal.toDecimalPlaces(2).toString(),
            taxAmount: taxAmount.toDecimalPlaces(2).toString(),
            total: total.toDecimalPlaces(2).toString(),
            lineItems: {
              create: finalLineItems.map((li) => ({
                ...(li.inventoryItemId && { inventoryItemId: li.inventoryItemId }),
                ...(li.productId && { productId: li.productId }),
                description: li.description,
                boxTypeSnapshot: li.boxTypeSnapshot,
                boxSizeSnapshot: li.boxSizeSnapshot,
                quantityOrdered: li.quantityOrdered,
                unitPrice: li.unitPrice.toDecimalPlaces(2).toString(),
                lineTotal: li.unitPrice.times(li.quantityOrdered).toDecimalPlaces(2).toString(),
              })),
            },
          }),
        },
        include: {
          store: { select: { id: true, name: true } },
          lineItems: true,
        },
      });
    });

    await createAuditLog({
      action: 'INVOICE_UPDATED',
      entityType: 'Invoice',
      entityId: id,
      entityLabel: existing.invoiceNumber,
      userId: req.user!.userId,
      ipAddress: req.ip,
      invoiceId: id,
      changeDetails: { status: 'DRAFT', total: total.toString() },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function sendInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: {
          include: {
            inventoryItem: {
              include: { boxType: true, boxSize: true },
            },
            product: true,
          },
        },
        store: true,
      },
    });

    if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

    if (invoice.status !== 'DRAFT') {
      throw new AppError(
        'Only DRAFT invoices can be sent',
        400,
        'INVOICE_STATUS_INVALID_TRANSITION'
      );
    }

    // Validate stock AND deduct inside a single transaction for atomicity
    const updated = await prisma.$transaction(async (tx) => {
      // Re-check and deduct box inventory
      const errors: string[] = [];
      for (const li of invoice.lineItems) {
        if (li.inventoryItemId) {
          // Read the latest stock inside the transaction
          const item = await tx.inventoryItem.findUnique({ where: { id: li.inventoryItemId }, include: { boxType: true, boxSize: true } });
          if (!item || item.quantity < li.quantityOrdered) {
            errors.push(
              `Insufficient stock for ${item?.boxType?.name ?? 'Unknown'} ${item?.boxSize?.name ?? ''}: available ${item?.quantity ?? 0}, required ${li.quantityOrdered}`
            );
            continue;
          }

          const after = item.quantity - li.quantityOrdered;
          await tx.inventoryItem.update({
            where: { id: li.inventoryItemId },
            data: { quantity: after },
          });
          await tx.inventoryTransaction.create({
            data: {
              inventoryItemId: li.inventoryItemId,
              type: 'INVOICE_DEDUCTION',
              quantityBefore: item.quantity,
              quantityChange: -li.quantityOrdered,
              quantityAfter: after,
              invoiceId: id,
              note: `Deducted for invoice ${invoice.invoiceNumber}`,
              performedById: req.user!.userId,
            },
          });
        }

        // Re-check and deduct product stock
        if (li.productId) {
          const productStock = await tx.productStock.findUnique({
            where: { productId_storeId: { productId: li.productId, storeId: invoice.storeId } },
          });
          const available = productStock?.quantity ?? 0;
          if (available < li.quantityOrdered) {
            const productName = li.product?.name ?? 'Unknown product';
            errors.push(
              `Insufficient stock for ${productName}: available ${available}, required ${li.quantityOrdered}`
            );
            continue;
          }

          const psAfter = productStock!.quantity - li.quantityOrdered;
          await tx.productStock.update({
            where: { id: productStock!.id },
            data: { quantity: psAfter },
          });
          await tx.inventoryTransaction.create({
            data: {
              productStockId: productStock!.id,
              type: 'INVOICE_DEDUCTION',
              quantityBefore: productStock!.quantity,
              quantityChange: -li.quantityOrdered,
              quantityAfter: psAfter,
              invoiceId: id,
              note: `Deducted for invoice ${invoice.invoiceNumber}`,
              performedById: req.user!.userId,
            },
          });
        }
      }

      if (errors.length > 0) {
        throw new AppError('Insufficient stock to send invoice', 400, 'INSUFFICIENT_INVENTORY', errors);
      }

      return tx.invoice.update({
        where: { id },
        data: { status: 'SENT' },
        include: {
          store: { select: { id: true, name: true } },
          lineItems: true,
        },
      });
    });

    await createAuditLog({
      action: 'INVOICE_SENT',
      entityType: 'Invoice',
      entityId: id,
      entityLabel: invoice.invoiceNumber,
      userId: req.user!.userId,
      ipAddress: req.ip,
      invoiceId: id,
      changeDetails: { statusBefore: 'DRAFT', statusAfter: 'SENT' },
    });

    // Send email notification to store
    if (invoice.store.email) {
      sendInvoiceEmail(invoice.store.email, {
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: id,
        storeName: invoice.store.name,
        contactName: invoice.store.contactName ?? invoice.store.name,
        total: Number(invoice.total).toFixed(2),
        currency: invoice.currency,
        dueDate: new Date(invoice.dueDate).toLocaleDateString('en-US'),
        issueDate: new Date(invoice.issueDate).toLocaleDateString('en-US'),
        lineItemCount: invoice.lineItems.length,
        notes: invoice.notes,
      }).catch(() => {}); // fire-and-forget, don't block response
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function payInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

    if (!['SENT', 'OVERDUE'].includes(invoice.status)) {
      throw new AppError(
        'Only SENT or OVERDUE invoices can be marked as paid',
        400,
        'INVOICE_STATUS_INVALID_TRANSITION'
      );
    }

    const paidAt = req.body?.paidDate ? new Date(req.body.paidDate) : new Date();

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'PAID', paidAt },
      include: { store: { select: { id: true, name: true, email: true, contactName: true } } },
    });

    await createAuditLog({
      action: 'INVOICE_PAID',
      entityType: 'Invoice',
      entityId: id,
      entityLabel: invoice.invoiceNumber,
      userId: req.user!.userId,
      ipAddress: req.ip,
      invoiceId: id,
      changeDetails: { statusBefore: invoice.status, statusAfter: 'PAID', paidAt },
    });

    // Send payment confirmation email
    if (updated.store.email) {
      sendInvoicePaidEmail(updated.store.email, {
        invoiceNumber: invoice.invoiceNumber,
        storeName: updated.store.name,
        contactName: updated.store.contactName ?? updated.store.name,
        total: Number(invoice.total).toFixed(2),
        paidDate: paidAt.toLocaleDateString('en-US'),
      }).catch(() => {});
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function cancelInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: {
          include: {
            inventoryItem: true,
          },
        },
      },
    });

    if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

    if (!['DRAFT', 'SENT', 'PAID', 'OVERDUE'].includes(invoice.status)) {
      throw new AppError(
        'Only DRAFT, SENT, PAID, or OVERDUE invoices can be cancelled',
        400,
        'INVOICE_STATUS_INVALID_TRANSITION'
      );
    }

    const wasSent = ['SENT', 'PAID', 'OVERDUE'].includes(invoice.status);

    const updated = await prisma.$transaction(async (tx) => {
      if (wasSent) {
        // Restore inventory for box line items
        for (const li of invoice.lineItems) {
          if (li.inventoryItemId && li.inventoryItem) {
            const before = li.inventoryItem.quantity;
            const after = before + li.quantityOrdered;

            await tx.inventoryItem.update({
              where: { id: li.inventoryItemId },
              data: { quantity: after },
            });

            await tx.inventoryTransaction.create({
              data: {
                inventoryItemId: li.inventoryItemId,
                type: 'INVOICE_RESTORE',
                quantityBefore: before,
                quantityChange: li.quantityOrdered,
                quantityAfter: after,
                invoiceId: id,
                note: `Restored from cancelled invoice ${invoice.invoiceNumber}`,
                performedById: req.user!.userId,
              },
            });
          }

          // Restore product stock
          if (li.productId) {
            const productStock = await tx.productStock.findUnique({
              where: { productId_storeId: { productId: li.productId, storeId: invoice.storeId } },
            });

            if (productStock) {
              const psBefore = productStock.quantity;
              const psAfter = psBefore + li.quantityOrdered;

              await tx.productStock.update({
                where: { id: productStock.id },
                data: { quantity: psAfter },
              });

              await tx.inventoryTransaction.create({
                data: {
                  productStockId: productStock.id,
                  type: 'INVOICE_RESTORE',
                  quantityBefore: psBefore,
                  quantityChange: li.quantityOrdered,
                  quantityAfter: psAfter,
                  invoiceId: id,
                  note: `Restored from cancelled invoice ${invoice.invoiceNumber}`,
                  performedById: req.user!.userId,
                },
              });
            }
          }
        }
      }

      return tx.invoice.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { store: { select: { id: true, name: true } } },
      });
    });

    await createAuditLog({
      action: 'INVOICE_CANCELLED',
      entityType: 'Invoice',
      entityId: id,
      entityLabel: invoice.invoiceNumber,
      userId: req.user!.userId,
      ipAddress: req.ip,
      invoiceId: id,
      changeDetails: { statusBefore: invoice.status, statusAfter: 'CANCELLED', inventoryRestored: wasSent },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function markOverdue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

    if (invoice.status !== 'SENT') {
      throw new AppError(
        'Only SENT invoices can be marked as overdue',
        400,
        'INVOICE_STATUS_INVALID_TRANSITION'
      );
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'OVERDUE' },
    });

    await createAuditLog({
      action: 'INVOICE_MARKED_OVERDUE',
      entityType: 'Invoice',
      entityId: id,
      entityLabel: invoice.invoiceNumber,
      userId: req.user!.userId,
      ipAddress: req.ip,
      invoiceId: id,
      changeDetails: { statusBefore: 'SENT', statusAfter: 'OVERDUE' },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

    // Wrap restore + delete in a single transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Restore inventory if this invoice had deductions (SENT, PAID, OVERDUE)
      if (['SENT', 'PAID', 'OVERDUE'].includes(invoice.status)) {
        const deductions = await tx.inventoryTransaction.findMany({
          where: { invoiceId: id, type: 'INVOICE_DEDUCTION' },
        });
        for (const txn of deductions) {
          if (txn.inventoryItemId) {
            await tx.inventoryItem.update({
              where: { id: txn.inventoryItemId },
              data: { quantity: { increment: Math.abs(txn.quantityChange) } },
            });
          }
          if (txn.productStockId) {
            await tx.productStock.update({
              where: { id: txn.productStockId },
              data: { quantity: { increment: Math.abs(txn.quantityChange) } },
            });
          }
        }
      }

      await tx.inventoryTransaction.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    await createAuditLog({
      action: 'INVOICE_DELETED',
      entityType: 'Invoice',
      entityId: id,
      entityLabel: invoice.invoiceNumber,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { status: invoice.status, total: invoice.total.toString() },
    });

    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function downloadPDF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        store: true,
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        lineItems: {
          include: {
            inventoryItem: {
              include: {
                boxType: { select: { id: true, name: true } },
                boxSize: { select: { id: true, name: true } },
              },
            },
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!invoice) throw new AppError('Invoice not found', 404, 'NOT_FOUND');

    const settings = await prisma.appSettings.findUnique({ where: { id: 'settings' } });
    const companyName = settings?.companyName || 'Pizza Box Co';

    const statusColors: Record<string, string> = {
      DRAFT: '#6b7280',
      SENT: '#3b82f6',
      PAID: '#10b981',
      CANCELLED: '#ef4444',
      OVERDUE: '#f59e0b',
    };

    const statusColor = statusColors[invoice.status] || '#6b7280';

    const lineItemsHtml = invoice.lineItems
      .map(
        (li) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${li.boxTypeSnapshot && li.boxSizeSnapshot ? `${li.boxTypeSnapshot} ${li.boxSizeSnapshot}` : li.description || '—'}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${li.quantityOrdered}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${invoice.currency} ${new Decimal(li.unitPrice.toString()).toFixed(2)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${invoice.currency} ${new Decimal(li.lineTotal.toString()).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; background: white; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .company-name { font-size: 28px; font-weight: 700; color: #1f2937; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 32px; font-weight: 700; color: #1f2937; }
    .invoice-title .number { color: #6b7280; font-size: 16px; margin-top: 4px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; color: white; background-color: ${statusColor}; margin-top: 8px; }
    .divider { border: none; border-top: 2px solid #e5e7eb; margin: 24px 0; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
    .detail-section h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 8px; }
    .detail-section p { font-size: 14px; color: #374151; margin-bottom: 4px; }
    .detail-section .value { font-weight: 600; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background-color: #f9fafb; }
    th { padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    th:last-child, td:last-child { text-align: right; }
    th:nth-child(2), td:nth-child(2) { text-align: center; }
    tbody tr:hover { background-color: #f9fafb; }
    .totals { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #374151; }
    .total-row.grand { border-top: 2px solid #1f2937; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 700; color: #1f2937; }
    .notes { margin-top: 40px; padding: 16px; background-color: #f9fafb; border-radius: 8px; }
    .notes h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }
    .notes p { font-size: 14px; color: #374151; }
    .footer { margin-top: 48px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="company-name">${companyName}</div>
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="number">${invoice.invoiceNumber}</div>
        <div><span class="status-badge">${invoice.status}</span></div>
      </div>
    </div>

    <hr class="divider">

    <div class="details-grid">
      <div class="detail-section">
        <h3>Bill To</h3>
        <p class="value">${invoice.store.name}</p>
        ${invoice.store.contactName ? `<p>${invoice.store.contactName}</p>` : ''}
        ${invoice.store.email ? `<p>${invoice.store.email}</p>` : ''}
        ${invoice.store.phone ? `<p>${invoice.store.phone}</p>` : ''}
        ${invoice.store.address ? `<p>${invoice.store.address}</p>` : ''}
        ${invoice.store.city || invoice.store.state || invoice.store.zipCode ? `<p>${[invoice.store.city, invoice.store.state, invoice.store.zipCode].filter(Boolean).join(', ')}</p>` : ''}
      </div>
      <div class="detail-section">
        <h3>Invoice Details</h3>
        <p>Issue Date: <span class="value">${new Date(invoice.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
        <p>Due Date: <span class="value">${new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
        ${invoice.paidAt ? `<p>Paid Date: <span class="value">${new Date(invoice.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>` : ''}
        <p>Currency: <span class="value">${invoice.currency}</span></p>
        <p>Tax Rate: <span class="value">${invoice.taxRate}%</span></p>
        <p>Prepared by: <span class="value">${invoice.createdBy.firstName} ${invoice.createdBy.lastName}</span></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${invoice.currency} ${new Decimal(invoice.subtotal.toString()).toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>Tax (${invoice.taxRate}%)</span>
        <span>${invoice.currency} ${new Decimal(invoice.taxAmount.toString()).toFixed(2)}</span>
      </div>
      <div class="total-row grand">
        <span>Total</span>
        <span>${invoice.currency} ${new Decimal(invoice.total.toString()).toFixed(2)}</span>
      </div>
    </div>

    ${invoice.notes ? `
    <div class="notes">
      <h3>Notes</h3>
      <p>${invoice.notes}</p>
    </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for your business — ${companyName}</p>
      <p style="margin-top: 4px;">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
  </div>
</body>
</html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.invoiceNumber}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(Buffer.from(pdfBuffer));
  } catch (err) {
    next(err);
  }
}
