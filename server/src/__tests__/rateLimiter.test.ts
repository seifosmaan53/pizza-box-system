import express from 'express';
import request from 'supertest';
import { loginRateLimiter, refreshRateLimiter } from '../middleware/rateLimiter';

/* Regression cover for a real defect: /auth/refresh was mounted behind
   loginRateLimiter, so it shared the login brute-force budget.

   The client calls /auth/refresh automatically on every page load, and a FAILED
   refresh (no cookie yet, or an expired one) is completely ordinary. Because the
   login limiter counts failures, those ordinary failures spent the credential-guessing
   budget. Two consequences, both reproduced by hand before the fix:

     1. Reload the app a few times while logged out and you could no longer log IN —
        the limiter that was supposed to protect the password was blocking the person
        who knew it.
     2. Worse, the bucket is keyed by IP and /auth/refresh needs no credentials, so
        any anonymous caller could exhaust it with ten requests and deny login to
        everyone sharing that address.

   These tests pin the two properties that make that impossible: the limiters are
   distinct, and spending one does not spend the other. */

// The login limiter allows 10 failures per IP per 15 minutes.
const LOGIN_MAX = 10;

/** Minimal app: each route always fails, so every request is counted
    (both limiters set skipSuccessfulRequests). */
function makeApp() {
  const app = express();
  app.post('/login', loginRateLimiter, (_req, res) => {
    res.status(401).json({ success: false });
  });
  app.post('/refresh', refreshRateLimiter, (_req, res) => {
    res.status(401).json({ success: false });
  });
  return app;
}

describe('auth rate limiters', () => {
  it('uses a different limiter for refresh than for login', () => {
    expect(refreshRateLimiter).not.toBe(loginRateLimiter);
  });

  it('does not spend the login budget when refresh fails repeatedly', async () => {
    const app = makeApp();

    // Exhaust well past the login allowance on the refresh route.
    for (let i = 0; i < LOGIN_MAX + 5; i++) {
      await request(app).post('/refresh');
    }

    // Login must still be reachable: it should answer with its own 401, not a 429.
    const res = await request(app).post('/login');
    expect(res.status).toBe(401);
  });

  it('still rate-limits repeated failed logins', async () => {
    const app = makeApp();

    let sawLimit = false;
    for (let i = 0; i < LOGIN_MAX + 2; i++) {
      const res = await request(app).post('/login');
      if (res.status === 429) sawLimit = true;
    }

    expect(sawLimit).toBe(true);
  });

  it('gives refresh enough headroom for ordinary page loads', async () => {
    const app = makeApp();

    // A person reloading the app repeatedly must not lock themselves out. This is
    // comfortably more reloads than the old shared budget of 10 allowed.
    for (let i = 0; i < 40; i++) {
      const res = await request(app).post('/refresh');
      expect(res.status).toBe(401);
    }
  });
});
