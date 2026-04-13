#!/usr/bin/env bash
# =============================================================
# Pizza Box System — Database Restore Script
# =============================================================
# Usage:
#   ./scripts/restore-db.sh backups/daily/pizzabox-20260413-020000.sql.gz
#
# WARNING: This will DROP and recreate the database!
# =============================================================

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo ""
  echo "Available backups:"
  BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
  find "${BACKUP_DIR}" -name "pizzabox-*.sql.gz" -printf "  %T+ %p\n" 2>/dev/null | sort -r | head -20
  exit 1
fi

BACKUP_FILE="$1"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-pizzabox}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "============================================"
echo "  DATABASE RESTORE"
echo "============================================"
echo "  File:     ${BACKUP_FILE}"
echo "  Database: ${DB_NAME}"
echo "  Host:     ${DB_HOST}:${DB_PORT}"
echo "============================================"
echo ""
echo "WARNING: This will DROP the '${DB_NAME}' database and restore from backup."
echo ""
read -p "Type 'RESTORE' to confirm: " CONFIRM

if [ "${CONFIRM}" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

echo "[$(date -Iseconds)] Starting restore..."

if command -v docker &>/dev/null && docker ps --format '{{.Names}}' | grep -q pizzabox_postgres; then
  echo "  Using Docker container: pizzabox_postgres"
  # Drop and recreate
  docker exec pizzabox_postgres psql -U "${DB_USER}" -c "DROP DATABASE IF EXISTS ${DB_NAME};"
  docker exec pizzabox_postgres psql -U "${DB_USER}" -c "CREATE DATABASE ${DB_NAME};"
  # Restore
  gunzip -c "${BACKUP_FILE}" | docker exec -i pizzabox_postgres psql -U "${DB_USER}" "${DB_NAME}"
else
  echo "  Using direct connection: ${DB_HOST}:${DB_PORT}"
  PGPASSWORD="${PGPASSWORD:-}" dropdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" --if-exists "${DB_NAME}"
  PGPASSWORD="${PGPASSWORD:-}" createdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"
  gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${PGPASSWORD:-}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"
fi

echo "[$(date -Iseconds)] Restore complete."
echo ""
echo "Next steps:"
echo "  1. Run 'npx prisma migrate deploy' to ensure schema is current"
echo "  2. Restart the server to pick up any changes"
