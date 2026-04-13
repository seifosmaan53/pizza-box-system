import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { createAuditLog } from '../utils/auditLog';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { sendPasswordResetEmail } from '../utils/email';
import { passwordSchema } from '../utils/validation';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  password: passwordSchema,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name required').max(100).optional(),
  lastName: z.string().min(1, 'Last name required').max(100).optional(),
});

const LOCK_THRESHOLD = 5;
const LOCK_WINDOW_SECONDS = 15 * 60; // 15 minutes
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function getRefreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
  };
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();
    const lockKey = `login_attempts:${normalizedEmail}`;

    // Check if account is locked
    const attemptsStr = await redis.get(lockKey);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

    if (attempts >= LOCK_THRESHOLD) {
      const ttl = await redis.ttl(lockKey);
      const minutesRemaining = Math.ceil(ttl / 60);
      throw new AppError(
        `Account temporarily locked. Try again in ${minutesRemaining} minute(s).`,
        429,
        'AUTH_ACCOUNT_LOCKED',
        { minutesRemaining }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.isActive) {
      // Increment attempts even for non-existent users to prevent enumeration
      await redis.multi()
        .incr(lockKey)
        .expire(lockKey, LOCK_WINDOW_SECONDS)
        .exec();
      throw new AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      const newAttempts = await redis.incr(lockKey);
      await redis.expire(lockKey, LOCK_WINDOW_SECONDS);

      if (newAttempts >= LOCK_THRESHOLD) {
        throw new AppError(
          'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
          429,
          'AUTH_ACCOUNT_LOCKED',
          { minutesRemaining: 15 }
        );
      }

      throw new AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    // Success — clear attempt counter
    await redis.del(lockKey);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken(user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

    // Audit log
    await createAuditLog({
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.email,
      userId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const oldToken = req.cookies?.refreshToken;

    if (!oldToken) {
      throw new AppError('Refresh token required', 401, 'REFRESH_TOKEN_MISSING');
    }

    // Check if token has been revoked
    const blacklisted = await redis.get(`blacklist:${oldToken}`);
    if (blacklisted) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    const payload = verifyRefreshToken(oldToken);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    // --- Refresh token rotation ---
    // Blacklist the old token immediately so it can't be reused
    await redis.set(`blacklist:${oldToken}`, 'rotated', 'EX', 7 * 24 * 60 * 60);

    // Issue new tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const newRefreshToken = generateRefreshToken(user.id);

    // Set the new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Blacklist the refresh token so it can't be reused
    const token = req.cookies?.refreshToken;
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        // Store in blacklist for the remaining token lifetime (7 days max)
        await redis.set(`blacklist:${token}`, payload.userId, 'EX', 7 * 24 * 60 * 60);
      } catch {
        // Token already invalid — no need to blacklist
      }
    }

    res.clearCookie('refreshToken', getRefreshCookieOptions());

    if (req.user) {
      await createAuditLog({
        action: 'USER_LOGOUT',
        entityType: 'User',
        entityId: req.user.userId,
        entityLabel: req.user.email,
        userId: req.user.userId,
        ipAddress: req.ip,
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    // Always respond with success to prevent email enumeration
    const successResponse = {
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    };

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.isActive) {
      res.json(successResponse);
      return;
    }

    // Invalidate existing tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;

    // Send email (falls back to console if SMTP not configured)
    await sendPasswordResetEmail(user.email, resetLink, user.firstName);

    logger.info('Password reset token created', {
      userId: user.id,
      email: user.email,
      expiresAt,
    });

    // In development, include the reset link in the response so it's usable without email
    if (process.env.NODE_ENV !== 'production') {
      res.json({ ...successResponse, data: { resetLink } });
    } else {
      res.json(successResponse);
    }
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.params;
    const { password } = resetPasswordSchema.parse(req.body);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (
      !resetToken ||
      resetToken.usedAt !== null ||
      resetToken.expiresAt < new Date()
    ) {
      throw new AppError(
        'Invalid or expired reset token',
        400,
        'RESET_TOKEN_INVALID'
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await createAuditLog({
      action: 'PASSWORD_RESET',
      entityType: 'User',
      entityId: resetToken.userId,
      entityLabel: resetToken.user.email,
      userId: resetToken.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
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

    if (!user || !user.isActive) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

    if (!user || !user.isActive) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await createAuditLog({
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.email,
      userId: user.id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const data = updateProfileSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!existing || !existing.isActive) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
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

    await createAuditLog({
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: updated.id,
      entityLabel: updated.email,
      userId: req.user.userId,
      ipAddress: req.ip,
      changeDetails: {
        before: { firstName: existing.firstName, lastName: existing.lastName },
        after: { firstName: updated.firstName, lastName: updated.lastName },
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
