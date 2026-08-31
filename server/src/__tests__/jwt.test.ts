/**
 * Tests for the JWT layer.
 *
 * This module had no tests, which is a poor place for a gap: it is what stands between
 * an anonymous request and an authenticated one. The cases below are chosen for the
 * properties that actually matter if they break — most importantly that the access and
 * refresh secrets are genuinely separate, so a refresh token can never be presented as
 * an access token.
 *
 * Secrets are set before importing the module because the expiry constants are read at
 * module load time.
 */

const ACCESS_SECRET = 'test-access-secret-not-used-anywhere-real';
const REFRESH_SECRET = 'test-refresh-secret-different-from-access';

process.env.JWT_SECRET = ACCESS_SECRET;
process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;

import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  TokenPayload,
} from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';

const payload: TokenPayload = {
  userId: 'user-123',
  email: 'someone@example.com',
  role: 'ADMIN',
};

describe('access tokens', () => {
  it('round-trips the payload', () => {
    const decoded = verifyAccessToken(generateAccessToken(payload));

    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('rejects a tampered token', () => {
    const token = generateAccessToken(payload);
    // flip a character in the signature segment
    const [header, body, signature] = token.split('.');
    const tampered = `${header}.${body}.${signature.slice(0, -1)}${
      signature.slice(-1) === 'a' ? 'b' : 'a'
    }`;

    expect(() => verifyAccessToken(tampered)).toThrow(AppError);
    expect(() => verifyAccessToken(tampered)).toThrow(/invalid access token/i);
  });

  it('rejects a token signed with a different secret', () => {
    const foreign = jwt.sign(payload, 'some-other-secret');

    expect(() => verifyAccessToken(foreign)).toThrow(/invalid access token/i);
  });

  it('reports expiry distinctly from invalidity, so the client can refresh', () => {
    const expired = jwt.sign(payload, ACCESS_SECRET, { expiresIn: '-1s' });

    try {
      verifyAccessToken(expired);
      throw new Error('expected verifyAccessToken to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError & { code?: string }).code).toBe('TOKEN_EXPIRED');
    }
  });

  it('rejects a malformed string', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow(AppError);
  });
});

describe('refresh tokens', () => {
  it('round-trips the user id and is marked as a refresh token', () => {
    const decoded = verifyRefreshToken(generateRefreshToken('user-123'));

    expect(decoded.userId).toBe('user-123');
    expect(decoded.type).toBe('refresh');
  });

  it('reports expiry with its own code', () => {
    const expired = jwt.sign({ userId: 'user-123', type: 'refresh' }, REFRESH_SECRET, {
      expiresIn: '-1s',
    });

    try {
      verifyRefreshToken(expired);
      throw new Error('expected verifyRefreshToken to throw');
    } catch (err) {
      expect((err as AppError & { code?: string }).code).toBe('REFRESH_TOKEN_EXPIRED');
    }
  });

  it('rejects a token signed with the refresh secret that is not marked as a refresh token', () => {
    // Correct signature, wrong purpose: without the explicit type check this would pass.
    const wrongType = jwt.sign({ userId: 'user-123', type: 'access' }, REFRESH_SECRET);

    expect(() => verifyRefreshToken(wrongType)).toThrow(/invalid token type/i);
  });
});

describe('the two token types are not interchangeable', () => {
  it('a refresh token is not accepted as an access token', () => {
    const refresh = generateRefreshToken('user-123');

    expect(() => verifyAccessToken(refresh)).toThrow(AppError);
  });

  it('an access token is not accepted as a refresh token', () => {
    const access = generateAccessToken(payload);

    expect(() => verifyRefreshToken(access)).toThrow(AppError);
  });

  it('the two secrets are actually different', () => {
    // If these ever collapse to the same value the two checks above pass for the wrong
    // reason, and a refresh token silently becomes a valid access token.
    expect(process.env.JWT_SECRET).not.toBe(process.env.JWT_REFRESH_SECRET);
  });
});
