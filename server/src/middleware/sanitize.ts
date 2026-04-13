import { Request, Response, NextFunction } from 'express';

/**
 * Recursively strip HTML tags from all string values in an object.
 * Preserves structure (arrays, nested objects) but sanitizes every string leaf.
 */
function stripHtmlTags(value: unknown): unknown {
  if (typeof value === 'string') {
    // Remove HTML tags and trim control characters
    return value
      .replace(/<[^>]*>/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }
  if (Array.isArray(value)) {
    return value.map(stripHtmlTags);
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      cleaned[key] = stripHtmlTags(val);
    }
    return cleaned;
  }
  return value;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params
 * by stripping HTML tags from all string values. Prevents stored XSS.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = stripHtmlTags(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = stripHtmlTags(req.query) as typeof req.query;
  }
  if (req.params && typeof req.params === 'object') {
    req.params = stripHtmlTags(req.params) as typeof req.params;
  }
  next();
}
