export const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'CANCELLED', 'OVERDUE'] as const;
export const ROLES = ['ADMIN', 'MANAGER', 'VIEWER'] as const;
export const CURRENCIES = ['USD'] as const;

export const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
] as const;

export const DATE_PRESETS = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 12 months', value: '12m' },
  { label: 'Custom', value: 'custom' },
] as const;

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 25;

// ─── Status Colors ──────────────────────────────────────────────────────────

/** Badge-style color names for Tailwind (used by Badge component) */
export const STATUS_BADGE_COLORS: Record<typeof INVOICE_STATUSES[number], 'gray' | 'blue' | 'green' | 'red' | 'orange'> = {
  DRAFT: 'gray',
  SENT: 'blue',
  PAID: 'green',
  CANCELLED: 'red',
  OVERDUE: 'orange',
};

/** Hex colors for chart libraries (Recharts, etc.) */
export const STATUS_HEX_COLORS: Record<typeof INVOICE_STATUSES[number], string> = {
  DRAFT: '#9ca3af',
  SENT: '#3b82f6',
  PAID: '#22c55e',
  CANCELLED: '#ef4444',
  OVERDUE: '#f97316',
};

// ─── Chart Colors ───────────────────────────────────────────────────────────

export const CHART_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];

export const CHART_AXIS_TICK = { fontSize: 11, fill: '#9ca3af' };
export const CHART_GRID_STYLE = { strokeDasharray: '3 3', stroke: '#e5e7eb', strokeOpacity: 0.5 };
export const CHART_TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', backgroundColor: 'rgba(255,255,255,0.95)', color: '#1f2937' };

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
  stores: 'stores',
  store: (id: string) => ['stores', id],
  storeSummary: (id: string) => ['stores', id, 'summary'],
  boxTypes: 'boxTypes',
  boxSizes: 'boxSizes',
  inventory: 'inventory',
  warehouseView: 'warehouseView',
  lowStock: 'lowStock',
  invoices: 'invoices',
  invoice: (id: string) => ['invoices', id],
  invoiceNextNumber: 'invoiceNextNumber',
  analytics: 'analytics',
  salesByStore: 'salesByStore',
  salesByBoxType: 'salesByBoxType',
  salesByBoxSize: 'salesByBoxSize',
  revenueOverTime: 'revenueOverTime',
  invoiceSummary: 'invoiceSummary',
  inventorySnapshot: 'inventorySnapshot',
  settings: 'settings',
  users: 'users',
  auditLog: 'auditLog',
} as const;
