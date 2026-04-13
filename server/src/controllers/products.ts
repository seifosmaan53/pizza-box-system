import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import prisma from '../lib/prisma';
import { createAuditLog } from '../utils/auditLog';
import { AppError } from '../middleware/errorHandler';

const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  unitPrice: z.number().positive('Unit price must be positive'),
});

const updateProductSchema = createProductSchema.partial();

const setStockSchema = z.object({
  storeId: z.string().uuid('Invalid store ID'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  lowStockThreshold: z.number().int().min(0).optional(),
});

const adjustStockSchema = z.object({
  storeId: z.string().uuid('Invalid store ID'),
  quantityChange: z.number().int().refine((n) => n !== 0, { message: 'Quantity change cannot be zero' }),
  note: z.string().max(500).optional(),
});

export async function getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const category = req.query.category ? String(req.query.category) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;

    const where: Prisma.ProductWhereInput = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        stock: {
          include: { store: { select: { id: true, name: true } } },
        },
        _count: { select: { lineItems: true } },
      },
    });

    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
}

export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        stock: {
          include: { store: { select: { id: true, name: true, currency: true } } },
        },
        _count: { select: { lineItems: true } },
      },
    });

    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createProductSchema.parse(req.body);

    // Check name uniqueness
    const existing = await prisma.product.findUnique({ where: { name: data.name } });
    if (existing) throw new AppError('A product with this name already exists', 409, 'CONFLICT');

    // Check SKU uniqueness if provided
    if (data.sku) {
      const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (existingSku) throw new AppError('A product with this SKU already exists', 409, 'CONFLICT');
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description || null,
        sku: data.sku || null,
        category: data.category || null,
        unitPrice: new Decimal(data.unitPrice).toDecimalPlaces(2).toString(),
        isActive: true,
      },
    });

    await createAuditLog({
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: product.id,
      entityLabel: product.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { name: data.name, unitPrice: data.unitPrice, sku: data.sku },
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = updateProductSchema.parse(req.body);

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Product not found', 404, 'NOT_FOUND');

    // Check name uniqueness if changing name
    if (data.name && data.name !== existing.name) {
      const nameConflict = await prisma.product.findUnique({ where: { name: data.name } });
      if (nameConflict) throw new AppError('A product with this name already exists', 409, 'CONFLICT');
    }

    // Check SKU uniqueness if changing sku
    if (data.sku && data.sku !== existing.sku) {
      const skuConflict = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (skuConflict) throw new AppError('A product with this SKU already exists', 409, 'CONFLICT');
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.unitPrice !== undefined && {
          unitPrice: new Decimal(data.unitPrice).toDecimalPlaces(2).toString(),
        }),
      },
    });

    await createAuditLog({
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: id,
      entityLabel: existing.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: data as Record<string, unknown>,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deactivateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Product not found', 404, 'NOT_FOUND');

    if (!existing.isActive) throw new AppError('Product is already inactive', 400, 'ALREADY_INACTIVE');

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      action: 'PRODUCT_DEACTIVATED',
      entityType: 'Product',
      entityId: id,
      entityLabel: existing.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { isActive: false },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function reactivateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Product not found', 404, 'NOT_FOUND');

    if (existing.isActive) throw new AppError('Product is already active', 400, 'ALREADY_ACTIVE');

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive: true },
    });

    await createAuditLog({
      action: 'PRODUCT_REACTIVATED',
      entityType: 'Product',
      entityId: id,
      entityLabel: existing.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { isActive: true },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new AppError('Product not found', 404, 'NOT_FOUND');

    // Check if used in any invoices
    const usedInInvoices = await prisma.invoiceLineItem.findFirst({
      where: { productId: id },
    });

    if (usedInInvoices) {
      throw new AppError(
        'Cannot delete a product that is referenced in invoices',
        409,
        'CANNOT_DELETE_HAS_CHILDREN'
      );
    }

    // Delete associated stock records first
    await prisma.productStock.deleteMany({ where: { productId: id } });

    await prisma.product.delete({ where: { id } });

    await createAuditLog({
      action: 'PRODUCT_DELETED',
      entityType: 'Product',
      entityId: id,
      entityLabel: existing.name,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { name: existing.name },
    });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getProductStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

    const stock = await prisma.productStock.findMany({
      where: { productId: id },
      include: {
        store: { select: { id: true, name: true, currency: true } },
      },
      orderBy: { store: { name: 'asc' } },
    });

    res.json({ success: true, data: stock });
  } catch (err) {
    next(err);
  }
}

export async function setProductStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = setStockSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

    const store = await prisma.store.findUnique({ where: { id: data.storeId } });
    if (!store) throw new AppError('Store not found', 404, 'NOT_FOUND');

    // Check existing stock to record the before-quantity for transaction
    const existingStock = await prisma.productStock.findUnique({
      where: { productId_storeId: { productId: id, storeId: data.storeId } },
    });
    const quantityBefore = existingStock?.quantity ?? 0;

    const stock = await prisma.productStock.upsert({
      where: { productId_storeId: { productId: id, storeId: data.storeId } },
      create: {
        productId: id,
        storeId: data.storeId,
        quantity: data.quantity,
        lowStockThreshold: data.lowStockThreshold ?? 20,
      },
      update: {
        quantity: data.quantity,
        ...(data.lowStockThreshold !== undefined && { lowStockThreshold: data.lowStockThreshold }),
      },
      include: {
        store: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    });

    // Create inventory transaction for tracking
    const quantityChange = data.quantity - quantityBefore;
    if (quantityChange !== 0) {
      await prisma.inventoryTransaction.create({
        data: {
          productStockId: stock.id,
          type: quantityChange > 0 ? 'MANUAL_ADD' : 'MANUAL_REMOVE',
          quantityBefore,
          quantityChange,
          quantityAfter: data.quantity,
          note: `Stock set to ${data.quantity}`,
          performedById: req.user!.userId,
        },
      });
    }

    await createAuditLog({
      action: 'PRODUCT_STOCK_SET',
      entityType: 'ProductStock',
      entityId: stock.id,
      entityLabel: `${product.name} @ ${store.name}`,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { quantity: data.quantity, storeId: data.storeId },
    });

    res.json({ success: true, data: stock });
  } catch (err) {
    next(err);
  }
}

export async function adjustProductStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = adjustStockSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

    const store = await prisma.store.findUnique({ where: { id: data.storeId } });
    if (!store) throw new AppError('Store not found', 404, 'NOT_FOUND');

    const existingStock = await prisma.productStock.findUnique({
      where: { productId_storeId: { productId: id, storeId: data.storeId } },
    });

    if (!existingStock) {
      throw new AppError(
        'No stock record found for this product and store. Use SET stock first.',
        404,
        'NOT_FOUND'
      );
    }

    const newQuantity = existingStock.quantity + data.quantityChange;

    if (newQuantity < 0) {
      throw new AppError(
        `Insufficient stock. Current: ${existingStock.quantity}, requested change: ${data.quantityChange}`,
        400,
        'INSUFFICIENT_INVENTORY'
      );
    }

    const updated = await prisma.productStock.update({
      where: { id: existingStock.id },
      data: { quantity: newQuantity },
      include: {
        store: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    });

    // Create inventory transaction for tracking
    await prisma.inventoryTransaction.create({
      data: {
        productStockId: existingStock.id,
        type: data.quantityChange > 0 ? 'MANUAL_ADD' : 'MANUAL_REMOVE',
        quantityBefore: existingStock.quantity,
        quantityChange: data.quantityChange,
        quantityAfter: newQuantity,
        note: data.note,
        performedById: req.user!.userId,
      },
    });

    await createAuditLog({
      action: 'PRODUCT_STOCK_ADJUSTED',
      entityType: 'ProductStock',
      entityId: existingStock.id,
      entityLabel: `${product.name} @ ${store.name}`,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: {
        quantityBefore: existingStock.quantity,
        quantityChange: data.quantityChange,
        quantityAfter: newQuantity,
        note: data.note,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
