import api from '@/lib/axios';
import type { ApiResponse, Product, ProductStock, CreateProductRequest, SetProductStockRequest } from '@/types';

export const productsApi = {
  getProducts: async (params?: { includeInactive?: boolean; category?: string; search?: string }): Promise<Product[]> => {
    const res = await api.get<ApiResponse<Product[]>>('/products', { params });
    return res.data.data;
  },
  getProduct: async (id: string): Promise<Product> => {
    const res = await api.get<ApiResponse<Product>>(`/products/${id}`);
    return res.data.data;
  },
  createProduct: async (data: CreateProductRequest): Promise<Product> => {
    const res = await api.post<ApiResponse<Product>>('/products', data);
    return res.data.data;
  },
  updateProduct: async (id: string, data: Partial<CreateProductRequest>): Promise<Product> => {
    const res = await api.put<ApiResponse<Product>>(`/products/${id}`, data);
    return res.data.data;
  },
  deactivateProduct: async (id: string): Promise<Product> => {
    const res = await api.patch<ApiResponse<Product>>(`/products/${id}/deactivate`);
    return res.data.data;
  },
  reactivateProduct: async (id: string): Promise<Product> => {
    const res = await api.patch<ApiResponse<Product>>(`/products/${id}/reactivate`);
    return res.data.data;
  },
  deleteProduct: async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`);
  },
  getProductStock: async (id: string): Promise<ProductStock[]> => {
    const res = await api.get<ApiResponse<ProductStock[]>>(`/products/${id}/stock`);
    return res.data.data;
  },
  setProductStock: async (id: string, data: SetProductStockRequest): Promise<ProductStock> => {
    const res = await api.post<ApiResponse<ProductStock>>(`/products/${id}/stock`, data);
    return res.data.data;
  },
  adjustProductStock: async (id: string, data: { storeId: string; quantityChange: number; note?: string }): Promise<ProductStock> => {
    const res = await api.patch<ApiResponse<ProductStock>>(`/products/${id}/stock/adjust`, data);
    return res.data.data;
  },
};
