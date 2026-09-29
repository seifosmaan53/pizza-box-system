import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";

export const loginRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
  skipSuccessfulRequests: true,
});

// Session refresh is NOT a credential-guessing endpoint, so it must not share the
// login bucket. The client calls it automatically on every page load, and a failed
// call (no cookie yet, or an expired one) is completely ordinary — under the login
// limiter those failures were spending the brute-force budget, with two consequences:
// a user who reloads a few times while logged out could no longer log in for 15
// minutes, and any anonymous caller could burn the whole bucket for their IP with ten
// cookie-less requests, locking out everyone behind the same NAT.
//
// The budget is generous because the request is machine-generated and already
// authenticated by an httpOnly cookie; it exists only to bound abuse.
export const refreshRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many session refresh attempts. Please try again shortly.",
  },
  skipSuccessfulRequests: true,
});

export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // reduced from 200 for tighter security
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please slow down.",
  },
});

export const forgotPasswordRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many password reset requests. Please try again in 1 hour.",
  },
});

// Strict limiter for sensitive write operations (user creation, settings changes)
export const sensitiveWriteRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please wait before trying again.",
  },
});

// Limiter for file upload endpoints
export const uploadRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many uploads. Please wait before uploading again.",
  },
});
