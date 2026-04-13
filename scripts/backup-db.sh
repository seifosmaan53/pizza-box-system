#!/usr/bin/env bash
# =============================================================
# Pizza Box System — Automated Database Backup Script
# =============================================================
# Usage:
#   ./scripts/backup-db.sh                  # Uses env vars or defaults
#   BACKUP_DIR=/mnt/backups ./scripts/backup-db.sh
#
# Cron example (daily at 2 AM):
#   0 2 * * * /path/to/pizza-box-system/scripts/backup-db.sh >> /var/log/pizzabox-backup.log 2>&1
#
# For Docker environments:
#   docker exec pizzabox_postgres pg_dump -U postgres pizzabox | gzip > backup.sql.gz
# =============================================================

set -euo pipefail

# --- Configuration (override via environment) ---
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-pizzabox}"
RETAIN_DAILY="${RETAIN_DAILY:-30}"     # Keep last 30 daily backups
RETAIN_WEEKLY="${RETAIN_WEEKLY:-12}"   # Keep last 12 weekly backups (Sundays)

# --- Derived ---
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAILY_DIR="${BACKUP_DIR}/daily"
WEEKLY_DIR="${BACKUP_DIR}/weekly"
BACKUP_FILE="pizzabox-${TIMESTAMP}.sql.gz"

# --- Ensure directories ---
mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"

echo "[$(date -Iseconds)] Starting database backup..."

# --- Dump database ---
if command -v docker &>/dev/null && docker ps --format '{{.Names}}' | grep -q pizzabox_postgres; then
  # Running in Docker — dump from container
  echo "  Using Docker container: pizzabox_postgres"
  docker exec pizzabox_postgres pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${DAILY_DIR}/${BACKUP_FILE}"
else
  # Direct PostgreSQL connection
  echo "  Using direct connection: ${DB_HOST}:${DB_PORT}"
  PGPASSWORD="${PGPASSWORD:-}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" | gzip > "${DAILY_DIR}/${BACKUP_FILE}"
fi

FILESIZE=$(du -h "${DAILY_DIR}/${BACKUP_FILE}" | cut -f1)
echo "  Backup created: ${DAILY_DIR}/${BACKUP_FILE} (${FILESIZE})"

# --- Weekly copy (on Sundays) ---
if [ "${DAY_OF_WEEK}" = "7" ]; then
  cp "${DAILY_DIR}/${BACKUP_FILE}" "${WEEKLY_DIR}/${BACKUP_FILE}"
  echo "  Weekly copy created: ${WEEKLY_DIR}/${BACKUP_FILE}"
fi

# --- Retention cleanup ---
# Remove daily backups older than RETAIN_DAILY days
find "${DAILY_DIR}" -name "pizzabox-*.sql.gz" -mtime +"${RETAIN_DAILY}" -delete 2>/dev/null || true
DAILY_COUNT=$(find "${DAILY_DIR}" -name "pizzabox-*.sql.gz" | wc -l | tr -d ' ')
echo "  Daily backups retained: ${DAILY_COUNT}"

# Remove weekly backups older than RETAIN_WEEKLY weeks
find "${WEEKLY_DIR}" -name "pizzabox-*.sql.gz" -mtime +$((RETAIN_WEEKLY * 7)) -delete 2>/dev/null || true
WEEKLY_COUNT=$(find "${WEEKLY_DIR}" -name "pizzabox-*.sql.gz" | wc -l | tr -d ' ')
echo "  Weekly backups retained: ${WEEKLY_COUNT}"

echo "[$(date -Iseconds)] Backup complete."
