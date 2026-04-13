// Shared TypeScript types between client and server

export type Role = 'ADMIN' | 'MANAGER' | 'VIEWER';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' | 'OVERDUE';

export type TransactionType =
  | 'MANUAL_ADD'
  | 'MANUAL_REMOVE'
  | 'INVOICE_DEDUCTION'
  | 'INVOICE_RESTORE'
  | 'ADJUSTMENT';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
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
  defaultShippingFee: string; // Decimal serialized as string
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
  createdAt: string;
  updatedAt: string;
}

export interface BoxSize {
  id: string;
  name: string;
  dimensions: string | null;
  sortOrder: number;
  isActive: boolean;
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
  reservedQty: number;
  pricePerUnit: string; // Decimal serialized as string
  lowStockThreshold: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
  boxTypeSnapshot: string;
  boxSizeSnapshot: string;
  quantityOrdered: number;
  unitPrice: string;
  lineTotal: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  storeId: string;
  store?: Store;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  currency: string;
  taxRate: number;
  subtotal: string;
  taxAmount: string;
  shippingFee: string;
  total: string;
  notes: string | null;
  internalNotes: string | null;
  createdById: string;
  createdBy?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  lineItems?: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  inventoryItem?: InventoryItem;
  type: TransactionType;
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
  invoiceId: string | null;
  note: string | null;
  performedById: string;
  performedBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  ipAddress: string | null;
  changeDetails: Record<string, unknown>;
  createdAt: string;
}

export interface AppSettings {
  id: string;
  companyName: string;
  logoUrl: string | null;
  defaultCurrency: string;
  defaultTaxRate: number;
  invoicePrefix: string;
  lowStockGlobal: number;
  updatedAt: string;
}

// API response wrappers
export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
    errors?: Array<{ field: string; message: string }>;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// Analytics types
export interface SalesByStore {
  storeId: string;
  storeName: string;
  revenue: number;
  unitsSold: number;
  invoiceCount: number;
}

export interface SalesByBoxType {
  boxType: string;
  revenue: number;
  unitsSold: number;
}

export interface SalesByBoxSize {
  boxSize: string;
  revenue: number;
  unitsSold: number;
}

export interface RevenueDataPoint {
  period: string;
  revenue: number;
  unitsSold: number;
}

export interface InvoiceSummary {
  DRAFT: { count: number; value: number };
  SENT: { count: number; value: number };
  PAID: { count: number; value: number };
  CANCELLED: { count: number; value: number };
  OVERDUE: { count: number; value: number };
}

export interface WarehouseViewItem {
  boxType: Pick<BoxType, 'id' | 'name'>;
  boxSize: Pick<BoxSize, 'id' | 'name' | 'sortOrder'>;
  totalQty: number;
  storeBreakdown: Array<{
    storeId: string;
    storeName: string;
    qty: number;
    inventoryItemId: string;
  }>;
}

// AI types
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIChatRequest {
  message: string;
  currentPage?: string;
  currentContext?: string;
}
