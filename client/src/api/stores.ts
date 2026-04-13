import api from '@/lib/axios';
import type {
  ApiResponse,
  Store,
  CreateStoreRequest,
  UpdateStoreRequest,
  GetStoresParams,
} from '@/types';

export interface StoreSummary {
  store: Store;
  inventoryItemCount: number;
  totalQuantity: number;
  totalInvoices: number;
  totalRevenue: number;
  outstandingAmount: number;
  lowStockCount: number;
}

export const storesApi = {
  getStores: async (params?: GetStoresParams): Promise<{ data: Store[] }> => {
    const res = await api.get<ApiResponse<Store[]>>('/stores', { params });
    return { data: res.data.data };
  },

  getStore: async (id: string): Promise<Store> => {
    const res = await api.get<ApiResponse<Store>>(`/stores/${id}`);
    return res.data.data;
  },

  getStoreSummary: async (id: string): Promise<StoreSummary> => {
    const res = await api.get<ApiResponse<StoreSummary>>(`/stores/${id}/summary`);
    return res.data.data;
  },

  createStore: async (data: CreateStoreRequest): Promise<Store> => {
    const res = await api.post<ApiResponse<Store>>('/stores', data);
    return res.data.data;
  },

  updateStore: async (id: string, data: UpdateStoreRequest): Promise<Store> => {
    const res = await api.put<ApiResponse<Store>>(`/stores/${id}`, data);
    return res.data.data;
  },

  deactivateStore: async (id: string): Promise<Store> => {
    const res = await api.patch<ApiResponse<Store>>(`/stores/${id}/deactivate`);
    return res.data.data;
  },

  reactivateStore: async (id: string): Promise<Store> => {
    const res = await api.patch<ApiResponse<Store>>(`/stores/${id}/reactivate`);
    return res.data.data;
  },

  deleteStore: async (id: string): Promise<void> => {
    await api.delete(`/stores/${id}`);
  },

  exportCSV: async (params?: GetStoresParams): Promise<Blob> => {
    const res = await api.get('/stores/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};

// Named function exports for direct import
export const getStores = storesApi.getStores;
export const getStore = storesApi.getStore;
export const getStoreSummary = storesApi.getStoreSummary;
export const createStore = storesApi.createStore;
export const updateStore = storesApi.updateStore;
export const deactivateStore = storesApi.deactivateStore;
export const reactivateStore = storesApi.reactivateStore;
export const deleteStore = storesApi.deleteStore;
