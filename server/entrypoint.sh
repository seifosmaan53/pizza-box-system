#!/bin/sh
# ============================================================
# Production Entrypoint
# Runs database migrations before starting the server.
# ============================================================
set -e

echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Migrations complete. Starting server..."
exec node dist/server.js
