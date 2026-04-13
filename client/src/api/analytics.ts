import api from '@/lib/axios';
import type {
  ApiResponse,
  SalesByStore,
  SalesByBoxType,
  SalesByBoxSize,
  RevenueDataPoint,
  InvoiceSummary,
  InventorySnapshot,
  AnalyticsParams,
} from '@/types';

export const analyticsApi = {
  getSalesByStore: async (params?: AnalyticsParams): Promise<SalesByStore[]> => {
    const res = await api.get<ApiResponse<SalesByStore[]>>('/analytics/sales-by-store', { params });
    return res.data.data;
  },

  getSalesByBoxType: async (params?: AnalyticsParams): Promise<SalesByBoxType[]> => {
    const res = await api.get<ApiResponse<SalesByBoxType[]>>('/analytics/sales-by-box-type', { params });
    return res.data.data;
  },

  getSalesByBoxSize: async (params?: AnalyticsParams): Promise<SalesByBoxSize[]> => {
    const res = await api.get<ApiResponse<SalesByBoxSize[]>>('/analytics/sales-by-box-size', { params });
    return res.data.data;
  },

  getRevenueOverTime: async (params?: AnalyticsParams): Promise<RevenueDataPoint[]> => {
    const res = await api.get<ApiResponse<RevenueDataPoint[]>>('/analytics/revenue-over-time', { params });
    return res.data.data;
  },

  getTopStores: async (params?: AnalyticsParams & { limit?: number }): Promise<SalesByStore[]> => {
    const res = await api.get<ApiResponse<SalesByStore[]>>('/analytics/top-stores', { params });
    return res.data.data;
  },

  getInvoiceSummary: async (params?: AnalyticsParams): Promise<InvoiceSummary> => {
    const res = await api.get<ApiResponse<Record<string, { count: number; value: number }>>>('/analytics/invoice-summary', { params });
    const raw = res.data.data;
    return {
      DRAFT: raw.DRAFT,
      SENT: raw.SENT,
      PAID: raw.PAID,
      CANCELLED: raw.CANCELLED,
      OVERDUE: raw.OVERDUE,
      totalDraft: raw.DRAFT?.count ?? 0,
      totalSent: raw.SENT?.count ?? 0,
      totalPaid: raw.PAID?.count ?? 0,
      totalCancelled: raw.CANCELLED?.count ?? 0,
      totalOverdue: raw.OVERDUE?.count ?? 0,
      totalOutstanding: (raw.SENT?.value ?? 0) + (raw.OVERDUE?.value ?? 0),
      totalRevenue: raw.PAID?.value ?? 0,
      overdueAmount: raw.OVERDUE?.value ?? 0,
    };
  },

  getInventorySnapshot: async (): Promise<InventorySnapshot> => {
    interface SnapshotItem { currentQty: number; isLowStock: boolean }
    const res = await api.get<ApiResponse<SnapshotItem[]>>('/analytics/inventory-snapshot');
    const items = res.data.data ?? [];
    return {
      totalItems: items.length,
      totalQuantity: items.reduce((sum, i) => sum + (i.currentQty ?? 0), 0),
      lowStockCount: items.filter((i) => i.isLowStock).length,
      totalValue: 0,
    };
  },
};

// Named function exports for direct import
export const getSalesByStore = analyticsApi.getSalesByStore;
export const getSalesByBoxType = analyticsApi.getSalesByBoxType;
export const getSalesByBoxSize = analyticsApi.getSalesByBoxSize;
export const getRevenueOverTime = analyticsApi.getRevenueOverTime;
export const getTopStores = analyticsApi.getTopStores;
export const getInvoiceSummary = analyticsApi.getInvoiceSummary;
export const getInventorySnapshot = analyticsApi.getInventorySnapshot;
