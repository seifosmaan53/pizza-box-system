import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

interface ValidationError {
  field: string;
  message: string;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const isProd = process.env.NODE_ENV === 'production';

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors: ValidationError[] = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors,
    });
    return;
  }

  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[]) || [];
      res.status(409).json({
        success: false,
        code: 'CONFLICT',
        message: `A record with this ${fields.join(', ')} already exists`,
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Record not found',
      });
      return;
    }

    if (err.code === 'P2003') {
      res.status(400).json({
        success: false,
        code: 'FOREIGN_KEY_CONSTRAINT',
        message: 'Referenced record does not exist',
      });
      return;
    }

    logger.error('Prisma known error', {
      code: err.code,
      meta: err.meta,
      message: err.message,
    });

    res.status(500).json({
      success: false,
      code: 'DATABASE_ERROR',
      message: isProd ? 'A database error occurred' : err.message,
    });
    return;
  }

  // Prisma validation error
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error', { message: err.message });
    res.status(400).json({
      success: false,
      code: 'DATABASE_VALIDATION_ERROR',
      message: isProd ? 'Invalid data provided' : err.message,
    });
    return;
  }

  // App errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('AppError 5xx', {
        code: err.code,
        message: err.message,
        stack: err.stack,
        path: req.path,
      });
    }

    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details !== undefined && { details: err.details }),
      ...((!isProd && err.statusCode >= 500) && { stack: err.stack }),
    });
    return;
  }

  // Unknown errors
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: isProd ? 'An unexpected error occurred' : err.message,
    ...(!isProd && { stack: err.stack }),
  });
}
