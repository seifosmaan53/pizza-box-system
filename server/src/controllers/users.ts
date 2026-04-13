import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { createAuditLog, buildDiff } from '../utils/auditLog';
import { AppError } from '../middleware/errorHandler';
import { passwordSchema } from '../utils/validation';

const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: passwordSchema,
  firstName: z.string().min(1, 'First name required').max(100),
  lastName: z.string().min(1, 'Last name required').max(100),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER']).default('VIEWER'),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
});

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (req.query.role) {
      where.role = req.query.role;
    }

    if (req.query.isActive !== undefined) {
      where.isActive = req.query.isActive === 'true';
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new AppError('A user with this email already exists', 409, 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await createAuditLog({
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.email,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: { email: user.email, role: user.role },
    });

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateUserSchema.parse(req.body);
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // Prevent removing the last admin
    if (data.role && data.role !== 'ADMIN' && existing.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) {
        throw new AppError('Cannot demote the last active admin', 400, 'LAST_ADMIN');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const before = {
      firstName: existing.firstName,
      lastName: existing.lastName,
      role: existing.role,
      isActive: existing.isActive,
    };

    const after = {
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      isActive: updated.isActive,
    };

    await createAuditLog({
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: updated.id,
      entityLabel: updated.email,
      userId: req.user!.userId,
      ipAddress: req.ip,
      changeDetails: buildDiff(before, after),
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (!existing.isActive) throw new AppError('User is already inactive', 400, 'ALREADY_INACTIVE');

    // Prevent deactivating last admin
    if (existing.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (adminCount <= 1) {
        throw new AppError('Cannot deactivate the last active admin', 400, 'LAST_ADMIN');
      }
    }

    // Prevent self-deactivation
    if (id === req.user!.userId) {
      throw new AppError('Cannot deactivate your own account', 400, 'SELF_DEACTIVATION');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });

    await createAuditLog({
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: id,
      entityLabel: existing.email,
      userId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function reactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (existing.isActive) throw new AppError('User is already active', 400, 'ALREADY_ACTIVE');

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, email: true, isActive: true },
    });

    await createAuditLog({
      action: 'USER_REACTIVATED',
      entityType: 'User',
      entityId: id,
      entityLabel: existing.email,
      userId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError('User not found', 404, 'NOT_FOUND');

    if (id === req.user!.userId) {
      throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE');
    }

    const auditLogCount = await prisma.auditLog.count({ where: { userId: id } });
    if (auditLogCount > 0) {
      throw new AppError(
        'Cannot delete user with existing audit logs. Deactivate instead.',
        409,
        'CANNOT_DELETE_HAS_CHILDREN',
        { auditLogCount }
      );
    }

    const invoiceCount = await prisma.invoice.count({ where: { createdById: id } });
    if (invoiceCount > 0) {
      throw new AppError(
        'Cannot delete user with existing invoices. Deactivate instead.',
        409,
        'CANNOT_DELETE_HAS_CHILDREN',
        { invoiceCount }
      );
    }

    await prisma.user.delete({ where: { id } });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
}
