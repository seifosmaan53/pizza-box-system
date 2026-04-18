// ─── API Error ────────────────────────────────────────────────────────────────

/** Normalized error shape produced by the axios response interceptor */
export interface ApiError {
  status?: number;
  message: string;
  data?: unknown;
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' | 'OVERDUE';
export type UserRole = 'ADMIN' | 'MANAGER' | 'VIEWER';
export type TransactionType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'INVOICE';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  currency: string;
  taxRate: number;
  defaultShippingFee: number | string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoxType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoxSize {
  id: string;
  name: string;
  dimensions: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  storeId: string;
  store?: Store;
  boxTypeId: string;
  boxType?: BoxType;
  boxSizeId: string;
  boxSize?: BoxSize;
  quantity: number;
  lowStockThreshold: number;
  pricePerUnit: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LowStockItem {
  id: string;
  storeId: string;
  boxTypeId?: string;
  boxSizeId?: string;
  quantity: number;
  lowStockThreshold: number;
  pricePerUnit?: string;
  storeName: string;
  boxTypeName: string;
  boxSizeName: string;
  kind?: 'box' | 'product';
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  unitPrice: string; // Decimal comes as string
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stock?: ProductStock[];
}

export interface ProductStock {
  id: string;
  productId: string;
  product?: Product;
  storeId: string;
  store?: Store;
  quantity: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string | null;
  inventoryItem?: InventoryItem;
  productStockId: string | null;
  productStock?: ProductStock;
  type: TransactionType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceId: string | null;
  referenceType: string | null;
  notes: string | null;
  createdBy: string | null;
  createdByUser?: User;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  inventoryItemId: string | null;
  inventoryItem?: InventoryItem & {
    boxType?: Pick<BoxType, 'id' | 'name'>;
    boxSize?: Pick<BoxSize, 'id' | 'name'>;
  };
  productId: string | null;
  product?: Pick<Product, 'id' | 'name' | 'sku'>;
  description: string;
  /** Server field name */
  quantityOrdered: number;
  unitPrice: string | number;
  /** Server field name */
  lineTotal: string | number;
  boxTypeSnapshot: string;
  boxSizeSnapshot: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  storeId: string;
  store?: Store;
  status: InvoiceStatus;
  currency: string;
  subtotal: string | number;
  taxRate: string | number;
  taxAmount: string | number;
  total: string | number;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
  overdueAt: string | null;
  notes: string | null;
  internalNotes: string | null;
  lineItems: InvoiceLineItem[];
  createdById: string | null;
  /** Server returns this as createdBy */
  createdBy?: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
  createdAt: string;
  updatedAt: string;
  _count?: { lineItems: number };
}

export interface AuditLog {
  id: string;
  userId: string | null;
  user?: User;
  action: string;
  entity: string;
  entityId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AppSettings {
  id: string;
  companyName: string;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyLogo: string | null;
  defaultCurrency: string;
  defaultTaxRate: number;
  invoicePrefix: string;
  invoiceFooter: string | null;
  lowStockGlobal: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Analytics Types ──────────────────────────────────────────────────────────

export interface SalesByStore {
  storeId: string;
  storeName: string;
  totalRevenue: number;
  revenue: number;
  invoiceCount: number;
  paidAmount: number;
  unitsSold: number;
}

export interface SalesByBoxType {
  boxTypeId: string;
  boxTypeName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface SalesByBoxSize {
  boxSizeId: string;
  boxSizeName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  invoiceCount: number;
}

export interface InvoiceSummaryStatusEntry {
  count: number;
  value: number;
}

export interface InvoiceSummary {
  totalDraft: number;
  totalSent: number;
  totalPaid: number;
  totalCancelled: number;
  totalOverdue: number;
  totalOutstanding: number;
  totalRevenue: number;
  overdueAmount: number;
  DRAFT?: InvoiceSummaryStatusEntry;
  SENT?: InvoiceSummaryStatusEntry;
  PAID?: InvoiceSummaryStatusEntry;
  CANCELLED?: InvoiceSummaryStatusEntry;
  OVERDUE?: InvoiceSummaryStatusEntry;
}

export interface InventorySnapshot {
  totalItems: number;
  totalQuantity: number;
  lowStockCount: number;
  totalValue: number;
}

export interface WarehouseCell {
  boxTypeId: string;
  boxTypeName: string;
  boxSizeId: string;
  boxSizeName: string;
  totalQuantity: number;
  storeBreakdown: { storeId: string; storeName: string; quantity: number }[];
}

export interface WarehouseMatrix {
  boxTypes: BoxType[];
  boxSizes: BoxSize[];
  cells: Record<string, Record<string, WarehouseCell>>;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Request Types ────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface CreateStoreRequest {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  currency?: string;
  taxRate?: number;
  defaultShippingFee?: number;
  notes?: string;
}

export interface UpdateStoreRequest extends Partial<CreateStoreRequest> {
  isActive?: boolean;
}

export interface CreateBoxTypeRequest {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface CreateBoxSizeRequest {
  name: string;
  dimensions?: string;
  sortOrder?: number;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  unitPrice: number;
}

export interface SetProductStockRequest {
  storeId: string;
  quantity: number;
  lowStockThreshold?: number;
}

export interface CreateInventoryItemRequest {
  storeId: string;
  boxTypeId: string;
  boxSizeId: string;
  quantity: number;
  pricePerUnit: number;
  lowStockThreshold?: number;
  notes?: string;
}

export interface AdjustInventoryRequest {
  type: 'MANUAL_ADD' | 'MANUAL_REMOVE' | 'ADJUSTMENT';
  quantityChange: number;
  note?: string;
}

export interface CreateInvoiceRequest {
  storeId: string;
  issueDate?: string;
  dueDate: string;
  notes?: string;
  internalNotes?: string;
  applyTax?: boolean;
  shippingFee?: number;
  lineItems: {
    inventoryItemId?: string;
    productId?: string;
    description?: string;
    quantityOrdered: number;
    unitPrice?: number;
  }[];
}

export interface UpdateInvoiceRequest extends Partial<CreateInvoiceRequest> {}

export interface GetInvoicesParams {
  page?: number;
  limit?: number;
  status?: InvoiceStatus | InvoiceStatus[];
  storeId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GetStoresParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  state?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AnalyticsParams {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  groupBy?: 'day' | 'week' | 'month';
}
