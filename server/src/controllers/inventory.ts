import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import Decimal from 'decimal.js';
import prisma from '../lib/prisma';
import { createAuditLog } from '../utils/auditLog';
import { AppError } from '../middleware/errorHandler';

const inventoryItemSchema = z.object({
  storeId: z.string().uuid(),
  boxTypeId: z.string().uuid(),
  boxSizeId: z.string().uuid(),
  quantity: z.number().int().min(0).default(0),
  pricePerUnit: z.number().positive('Price must be positive'),
  lowStockThreshold: z.number().int().min(0).default(20),
  notes: z.string().max(500).optional().nullable(),
});

const updateInventoryItemSchema = z.object({
  pricePerUnit: z.number().positive().optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional().nullable(),
  quantity: z.number().int().min(0).optional(),
});

const adjustInventorySchema = z.object({
  quantityChange: z.number().int().refine((n) => n !== 0, { message: 'Quantity change cannot be zero' }),
  note: z.string().max(500).optional(),
  type: z.enum(['MANUAL_ADD', 'MANUAL_REMOVE', 'ADJUSTMENT']),
});

export async function getInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryItemWhereInput = {};

    if (req.query.storeId) where.storeId = String(req.query.storeId);
    if (req.query.boxTypeId) where.boxTypeId = String(req.query.boxTypeId);
    if (req.query.boxSizeId) where.boxSizeId = String(req.query.boxSizeId);

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ store: { name: 'asc' } }, { boxType: { name: 'asc' } }],
        include: {
          store: { select: { id: true, name: true, currency: true } },
          boxType: { select: { id: true, name: true } },
          boxSize: { select: { id: true, name: true, sortOrder: true } },
        },
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getWarehouseView(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: {
        store: { select: { id: true, name: true } },
        boxType: { select: { id: true, name: true } },
        boxSize: { select: { id: true, name: true, sortOrder: true } },
      },
      orderBy: [{ boxType: { name: 'asc' } }, { boxSize: { sortOrder: 'asc' } }],
    });

    // Group by boxTypeId + boxSizeId
    const grouped = new Map<
      string,
      {
        boxType: { id: string; name: string };
        boxSize: { id: string; name: string; sortOrder: number };
        totalQty: number;
        storeBreakdown: Array<{ storeId: string; storeName: string; qty: number; pricePerUnit: Decimal }>;
      }
    >();

    for (const item of items) {
      const key = `${item.boxTypeId}:${item.boxSizeId}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          boxType: item.boxType,
          boxSize: item.boxSize,
          totalQty: 0,
          storeBreakdown: [],
        });
      }
      const group = grouped.get(key)!;
      group.totalQty += item.quantity;
      group.storeBreakdown.push({
        storeId: item.storeId,
        storeName: item.store.name,
        qty: item.quantity,
        pricePerUnit: item.pricePerUnit,
      });
    }

    const result = Array.from(grouped.values());

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getWarehouseDrilldown(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { boxTypeId, boxSizeId } = req.params;

    const items = await prisma.inventoryItem.findMany({
      where: { boxTypeId, boxSizeId },
      include: {
        store: { select: { id: true, name: true, city: true, state: true, currency: true } },
        boxType: { select: { id: true, name: true } },
        boxSize: { select: { id: true, name: true } },
      },
      orderBy: { store: { name: 'asc' } },
    });

    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function getStoreInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId } = req.params;

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new AppError('Store not found', 404, 'NOT_FOUND');

    const items = await prisma.inventoryItem.findMany({
      where: { storeId },
      include: {
        boxType: { select: { id: true, name: true } },
        boxSize: { select: { id: true, name: true, sortOrder: true } },
      },
      orderBy: [{ boxType: { name: 'asc' } }, { boxSize: { sortOrder: 'asc' } }],
    });

    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

export async function getStoreProductStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId } = req.params;
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new AppError('Store not found', 404, 'NOT_FOUND');

    const stock = await prisma.productStock.findMany({
      where: { storeId },
      include: {
        product: { select: { id: true, name: true, sku: true, category: true, unitPrice: true, isActive: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });

    res.json({ success: true, data: stock });
  } catch (err) {
    next(err);
  }
}

export async function getLowStockItems(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: {
        quantity: {
          lte: prisma.inventoryItem.fields.lowStockThreshold as unknown as number,
        },
      },
    }).catch(() => {
      // Fallback: raw comparison
      return prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT i.*, s.name as store_name, bt.name as box_type_name, bs.name as box_size_name
        FROM "InventoryItem" i
        JOIN "Store" s ON s.id = i."storeId"
        JOIN "BoxType" bt ON bt.id = i."boxTypeId"
        JOIN "BoxSize" bs ON bs.id = i."boxSizeId"
        WHERE i.quantity <= i."lowStockThreshold"
        ORDER BY (i.quantity::float / NULLIF(i."lowStockThreshold", 0)) ASC
      `;
    });

    // Use raw query for comparing quantity <= lowStockThreshold (column comparison)
    const lowStockItems = await prisma.$queryRaw<Array<{
      id: string;
      storeId: string;
      boxTypeId: string;
      boxSizeId: string;
      quantity: number;
      lowStockThreshold: number;
      pricePerUnit: string;
      storeName: string;
      boxTypeName: string;
      boxSizeName: string;
    }>>`
      SELECT
        i.id,
        i."storeId",
        i."boxTypeId",
        i."boxSizeId",
        i.quantity,
        i."lowStockThreshold",
        i."pricePerUnit",
        s.name as "storeName",
        bt.name as "boxTypeName",
        bs.name as "boxSizeName"
      FROM "InventoryItem" i
      JOIN "Store" s ON s.id = i."storeId"
      JOIN "BoxType" bt ON bt.id = i."boxTypeId"
      JOIN "BoxSize" bs ON bs.id = i."boxSizeId"
      WHERE i.quantity <= i."lowStockThreshold"
      ORDER BY (i.quantity::float / NULLIF(i."lowStockThreshold", 0)) ASC
    `;

    void items; // suppress unused warning

    // Also get low-stock products
    const lowStockProducts = await prisma.$queryRaw<Array<{
      id: string;
      storeId: string;
      productId: string;
      quantity: number;
      lowStockThreshold: number;
      storeName: string;
      productName: string;
      productSku: string | null;
    }>>`
      SELECT
        ps.id,
        ps."storeId",
        ps."productId",
        ps.quantity,
        ps."lowStockThreshold",
        s.name as "storeName",
        p.name as "productName",
        p.sku as "productSku"
      FROM "ProductStock" ps
      JOIN "Store" s ON s.id = ps."storeId"
      JOIN "Product" p ON p.id = ps."productId"
      WHERE ps.quantity <= ps."lowStockThreshold"
        AND p."isActive" = true
      ORDER BY (ps.quantity::float / NULLIF(ps."lowStockThreshold", 0)) ASC
    `;

    // Merge both lists with a kind discriminator
    const combined = [
      ...lowStockItems.map((item) => ({ ...item, kind: 'box' as const })),
      ...lowStockProducts.map((item) => ({
        id: item.id,
        storeId: item.storeId,
        quantity: item.quantity,
        lowStockThreshold: item.lowStockThreshold,
        storeName: item.storeName,
        boxTypeName: item.productName,
        boxSizeName: item.productSku ?? 'Product',
        kind: 'product' as const,
      })),
    ];

    res.json({ success: true, data: combined });
  } catch (err) {
    next(err);
  }
}

export async function getInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
      include: {
        store: { select: { id: true, name: true, currency: true } },
        boxType: { select: { id: true, name: true } },
        boxSize: { select: { id: true, name: true, dimensions: true } },
      },
    });

    if (!item) throw new AppError('Inventory item not found', 404, 'NOT_FOUND');

    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function createInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = inventoryItemSchema.parse(req.body);

    // Validate store exists
    const store = await prisma.store.findUnique({ where: { id: data.storeId } });
    if (!store) throw new AppError('Store not found', 404, 'NOT_FOUND');

    // Validate boxType exists
    const boxType = await prisma.boxType.findUnique({ where: { id: data.boxTypeId } });
    if (!boxType) throw new AppError('Box type not found', 404, 'NOT_FOUND');

    // Validate boxSize exists
    const boxSize = await prisma.boxSize.findUnique({ where: { id: data.boxSizeId } });
    if (!boxSize) throw new AppError('Box size not found', 404, 'NOT_FOUND');

    // Check unique constraint
    const existing = await prisma.inventoryItem.findUnique({
      where: {
        storeId_boxTypeId_boxSizeId: {
          storeId: data.storeId,
          boxTypeId: data.boxTypeId,
          boxSizeId: data.boxSizeId,
        },
      },
    });

    if (existing) {
      throw new AppError(
        'An inventory item for this store, box type, and box size combination already exists.',
        409,
        'CONFLICT'
      );
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          storeId: data.storeId,
          boxTypeId: data.boxTypeId,
          boxSizeId: data.boxSizeId,
          quantity: data.quantity,
          pricePerUnit: new Decimal(data.pricePerUnit).toDecimalPlaces(2).toString(),
          lowStockThreshold: data.lowStockThreshold,
          notes: data.notes,
        },
        include: {
          store: { select: { id: true, name: true } },
          boxType: { select: { id: true, name: true } },
          boxSize: { select: { id: true, name: true } },
        },
      });

      if (data.quantity > 0) {
        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: created.id,
            type: 'MANUAL_ADD',
            quantityBefore: 0,
            quantityChange: data.quantity,
            quantityAfter: data.quantity,
            note: 'Initial stock',
            performedById: req.user!.userId,
          },
        });
      }

      return created;
    });

    await createAuditLog({
      action: 'INVENTORY_ITEM_CREATED',
      entityType: 'InventoryItem',
      entityId: item.id,
      entityLabel: `${item.store.name} - ${item.boxType.name} ${item.boxSize.name}`,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { quantity: data.quantity, pricePerUnit: data.pricePerUnit },
    });

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = updateInventoryItemSchema.parse(req.body);

    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true } },
        boxType: { select: { id: true, name: true } },
        boxSize: { select: { id: true, name: true } },
      },
    });

    if (!existing) throw new AppError('Inventory item not found', 404, 'NOT_FOUND');

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.inventoryItem.update({
        where: { id },
        data: {
          ...(data.pricePerUnit !== undefined && {
            pricePerUnit: new Decimal(data.pricePerUnit).toDecimalPlaces(2).toString(),
          }),
          ...(data.lowStockThreshold !== undefined && { lowStockThreshold: data.lowStockThreshold }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.quantity !== undefined && { quantity: data.quantity }),
        },
        include: {
          store: { select: { id: true, name: true } },
          boxType: { select: { id: true, name: true } },
          boxSize: { select: { id: true, name: true } },
        },
      });

      if (data.quantity !== undefined && data.quantity !== existing.quantity) {
        const change = data.quantity - existing.quantity;
        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: id,
            type: change > 0 ? 'MANUAL_ADD' : 'MANUAL_REMOVE',
            quantityBefore: existing.quantity,
            quantityChange: change,
            quantityAfter: data.quantity,
            note: 'Manual update',
            performedById: req.user!.userId,
          },
        });
      }

      return result;
    });

    await createAuditLog({
      action: 'INVENTORY_ITEM_UPDATED',
      entityType: 'InventoryItem',
      entityId: id,
      entityLabel: `${existing.store.name} - ${existing.boxType.name} ${existing.boxSize.name}`,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: data as Record<string, unknown>,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function adjustInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = adjustInventorySchema.parse(req.body);

    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true } },
        boxType: { select: { id: true, name: true } },
        boxSize: { select: { id: true, name: true } },
      },
    });

    if (!existing) throw new AppError('Inventory item not found', 404, 'NOT_FOUND');

    const newQty = existing.quantity + data.quantityChange;

    if (newQty < 0) {
      throw new AppError(
        `Insufficient inventory. Current: ${existing.quantity}, requested change: ${data.quantityChange}`,
        400,
        'INSUFFICIENT_INVENTORY',
        { currentQuantity: existing.quantity, quantityChange: data.quantityChange }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.inventoryItem.update({
        where: { id },
        data: { quantity: newQty },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          type: data.type,
          quantityBefore: existing.quantity,
          quantityChange: data.quantityChange,
          quantityAfter: newQty,
          note: data.note || null,
          performedById: req.user!.userId,
        },
      });

      return result;
    });

    await createAuditLog({
      action: 'INVENTORY_ADJUSTED',
      entityType: 'InventoryItem',
      entityId: id,
      entityLabel: `${existing.store.name} - ${existing.boxType.name} ${existing.boxSize.name}`,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: {
        type: data.type,
        quantityBefore: existing.quantity,
        quantityChange: data.quantityChange,
        quantityAfter: newQty,
        note: data.note,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function adjustProductStockItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const data = adjustInventorySchema.parse(req.body);

    const existing = await prisma.productStock.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true } },
        product: { select: { id: true, name: true } },
      },
    });

    if (!existing) throw new AppError('Product stock item not found', 404, 'NOT_FOUND');

    const newQty = existing.quantity + data.quantityChange;

    if (newQty < 0) {
      throw new AppError(
        `Insufficient stock. Current: ${existing.quantity}, requested change: ${data.quantityChange}`,
        400,
        'INSUFFICIENT_INVENTORY',
        { currentQuantity: existing.quantity, quantityChange: data.quantityChange }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.productStock.update({
        where: { id },
        data: { quantity: newQty },
        include: {
          product: { select: { id: true, name: true, sku: true, unitPrice: true } },
          store: { select: { id: true, name: true } },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          productStockId: id,
          type: data.type,
          quantityBefore: existing.quantity,
          quantityChange: data.quantityChange,
          quantityAfter: newQty,
          note: data.note || null,
          performedById: req.user!.userId,
        },
      });

      return result;
    });

    await createAuditLog({
      action: 'PRODUCT_STOCK_ADJUSTED',
      entityType: 'ProductStock',
      entityId: id,
      entityLabel: `${existing.store.name} - ${existing.product.name}`,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: {
        type: data.type,
        quantityBefore: existing.quantity,
        quantityChange: data.quantityChange,
        quantityAfter: newQty,
        note: data.note,
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteInventoryItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) throw new AppError('Inventory item not found', 404, 'NOT_FOUND');

    // Check if used in non-CANCELLED invoices
    const activeLineItems = await prisma.invoiceLineItem.findFirst({
      where: {
        inventoryItemId: id,
        invoice: { status: { not: 'CANCELLED' } },
      },
    });

    if (activeLineItems) {
      throw new AppError(
        'Cannot delete inventory item that is used in active invoices.',
        409,
        'CANNOT_DELETE_HAS_CHILDREN'
      );
    }

    await prisma.inventoryItem.delete({ where: { id } });

    res.json({ success: true, message: 'Inventory item deleted successfully' });
  } catch (err) {
    next(err);
  }
}

interface CsvRow {
  store_name: string;
  box_type: string;
  box_size: string;
  quantity: string;
  price_per_unit: string;
  low_stock_threshold?: string;
  notes?: string;
}

export async function bulkImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('CSV file is required', 400, 'FILE_REQUIRED');
    }

    const csvContent = req.file.buffer.toString('utf-8');

    let rows: CsvRow[];
    try {
      rows = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as CsvRow[];
    } catch {
      throw new AppError('Invalid CSV format', 400, 'INVALID_CSV');
    }

    if (rows.length === 0) {
      throw new AppError('CSV file is empty', 400, 'EMPTY_CSV');
    }

    // Pre-load all stores, box types, box sizes for validation
    const [stores, boxTypes, boxSizes] = await Promise.all([
      prisma.store.findMany({ select: { id: true, name: true } }),
      prisma.boxType.findMany({ select: { id: true, name: true } }),
      prisma.boxSize.findMany({ select: { id: true, name: true } }),
    ]);

    const storeMap = new Map(stores.map((s) => [s.name.toLowerCase(), s]));
    const boxTypeMap = new Map(boxTypes.map((bt) => [bt.name.toLowerCase(), bt]));
    const boxSizeMap = new Map(boxSizes.map((bs) => [bs.name.toLowerCase(), bs]));

    const errors: Array<{ row: number; field: string; message: string }> = [];
    const validatedRows: Array<{
      storeId: string;
      boxTypeId: string;
      boxSizeId: string;
      quantity: number;
      pricePerUnit: number;
      lowStockThreshold: number;
      notes: string | null;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed with header

      // Validate store
      const store = storeMap.get((row.store_name || '').toLowerCase().trim());
      if (!store) {
        errors.push({ row: rowNum, field: 'store_name', message: `Store "${row.store_name}" not found` });
      }

      // Validate box type
      const boxType = boxTypeMap.get((row.box_type || '').toLowerCase().trim());
      if (!boxType) {
        errors.push({ row: rowNum, field: 'box_type', message: `Box type "${row.box_type}" not found` });
      }

      // Validate box size
      const boxSize = boxSizeMap.get((row.box_size || '').toLowerCase().trim());
      if (!boxSize) {
        errors.push({ row: rowNum, field: 'box_size', message: `Box size "${row.box_size}" not found` });
      }

      // Validate quantity
      const quantity = parseInt(String(row.quantity), 10);
      if (isNaN(quantity) || quantity < 0) {
        errors.push({ row: rowNum, field: 'quantity', message: 'Quantity must be a non-negative integer' });
      }

      // Validate price
      const price = parseFloat(String(row.price_per_unit));
      if (isNaN(price) || price <= 0) {
        errors.push({ row: rowNum, field: 'price_per_unit', message: 'Price must be a positive number' });
      }

      if (store && boxType && boxSize && !isNaN(quantity) && quantity >= 0 && !isNaN(price) && price > 0) {
        const lowStockThreshold = row.low_stock_threshold
          ? parseInt(String(row.low_stock_threshold), 10)
          : 20;

        validatedRows.push({
          storeId: store.id,
          boxTypeId: boxType.id,
          boxSizeId: boxSize.id,
          quantity,
          pricePerUnit: price,
          lowStockThreshold: isNaN(lowStockThreshold) ? 20 : lowStockThreshold,
          notes: row.notes || null,
        });
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        code: 'CSV_VALIDATION_ERROR',
        message: `${errors.length} row(s) have errors`,
        errors,
      });
      return;
    }

    let added = 0;
    let updated = 0;

    for (const row of validatedRows) {
      const existing = await prisma.inventoryItem.findUnique({
        where: {
          storeId_boxTypeId_boxSizeId: {
            storeId: row.storeId,
            boxTypeId: row.boxTypeId,
            boxSizeId: row.boxSizeId,
          },
        },
      });

      if (existing) {
        await prisma.$transaction(async (tx) => {
          const prev = await tx.inventoryItem.findUnique({ where: { id: existing.id } });
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: {
              quantity: row.quantity,
              pricePerUnit: new Decimal(row.pricePerUnit).toDecimalPlaces(2).toString(),
              lowStockThreshold: row.lowStockThreshold,
              notes: row.notes,
            },
          });

          if (prev && row.quantity !== prev.quantity) {
            const change = row.quantity - prev.quantity;
            await tx.inventoryTransaction.create({
              data: {
                inventoryItemId: existing.id,
                type: 'ADJUSTMENT',
                quantityBefore: prev.quantity,
                quantityChange: change,
                quantityAfter: row.quantity,
                note: 'Bulk import update',
                performedById: req.user!.userId,
              },
            });
          }
        });
        updated++;
      } else {
        await prisma.$transaction(async (tx) => {
          const created = await tx.inventoryItem.create({
            data: {
              storeId: row.storeId,
              boxTypeId: row.boxTypeId,
              boxSizeId: row.boxSizeId,
              quantity: row.quantity,
              pricePerUnit: new Decimal(row.pricePerUnit).toDecimalPlaces(2).toString(),
              lowStockThreshold: row.lowStockThreshold,
              notes: row.notes,
            },
          });

          if (row.quantity > 0) {
            await tx.inventoryTransaction.create({
              data: {
                inventoryItemId: created.id,
                type: 'MANUAL_ADD',
                quantityBefore: 0,
                quantityChange: row.quantity,
                quantityAfter: row.quantity,
                note: 'Bulk import',
                performedById: req.user!.userId,
              },
            });
          }
        });
        added++;
      }
    }

    await createAuditLog({
      action: 'INVENTORY_BULK_IMPORT',
      entityType: 'InventoryItem',
      entityId: 'bulk',
      entityLabel: 'Bulk Import',
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { added, updated, total: added + updated },
    });

    res.json({
      success: true,
      data: { added, updated, total: added + updated },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAllTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryTransactionWhereInput = {};

    if (req.query.type) where.type = req.query.type as Prisma.EnumTransactionTypeFilter;
    if (req.query.inventoryItemId) where.inventoryItemId = String(req.query.inventoryItemId);
    if (req.query.invoiceId) where.invoiceId = String(req.query.invoiceId);

    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(String(req.query.startDate));
      }
      if (req.query.endDate) {
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(String(req.query.endDate));
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          inventoryItem: {
            include: {
              store: { select: { id: true, name: true } },
              boxType: { select: { id: true, name: true } },
              boxSize: { select: { id: true, name: true } },
            },
          },
          performedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getItemTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));
    const skip = (page - 1) * limit;

    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new AppError('Inventory item not found', 404, 'NOT_FOUND');

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: { inventoryItemId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      prisma.inventoryTransaction.count({ where: { inventoryItemId: id } }),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}
