import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
}

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  } as jwt.SignOptions);
}

export function generateRefreshToken(userId: string): string {
  const payload: RefreshTokenPayload = { userId, type: 'refresh' };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Access token expired', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid access token', 401, 'TOKEN_INVALID');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401, 'TOKEN_INVALID');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
    }
    throw new AppError('Invalid refresh token', 401, 'TOKEN_INVALID');
  }
}
