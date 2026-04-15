import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import type { InvoiceStatus } from '@/types';

// ─── Currency ────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, _currency?: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Dates ───────────────────────────────────────────────────────────────────

function parseDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsed) ? parsed : null;
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '—';
  return format(d, 'MMM d, yyyy');
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '—';
  return format(d, 'MMM d, yyyy h:mm a');
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatDateInput(date: string | Date | null | undefined): string {
  const d = parseDate(date);
  if (!d) return '';
  return format(d, 'yyyy-MM-dd');
}

// ─── Invoice Status ───────────────────────────────────────────────────────────

export function getStatusColor(status: InvoiceStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'SENT':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'PAID':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'CANCELLED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'OVERDUE':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export function getStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'SENT':
      return 'Sent';
    case 'PAID':
      return 'Paid';
    case 'CANCELLED':
      return 'Cancelled';
    case 'OVERDUE':
      return 'Overdue';
    default:
      return status;
  }
}

// ─── Numbers ─────────────────────────────────────────────────────────────────

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  if (isNaN(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}
