import api from '@/lib/axios';
import type { ApiResponse, BoxSize, CreateBoxSizeRequest } from '@/types';

export const boxSizesApi = {
  getBoxSizes: async (includeInactive = false): Promise<BoxSize[]> => {
    const res = await api.get<ApiResponse<BoxSize[]>>('/box-sizes', {
      params: { includeInactive },
    });
    return res.data.data;
  },

  createBoxSize: async (data: CreateBoxSizeRequest): Promise<BoxSize> => {
    const res = await api.post<ApiResponse<BoxSize>>('/box-sizes', data);
    return res.data.data;
  },

  updateBoxSize: async (id: string, data: Partial<CreateBoxSizeRequest>): Promise<BoxSize> => {
    const res = await api.put<ApiResponse<BoxSize>>(`/box-sizes/${id}`, data);
    return res.data.data;
  },

  deactivateBoxSize: async (id: string): Promise<BoxSize> => {
    const res = await api.patch<ApiResponse<BoxSize>>(`/box-sizes/${id}/deactivate`);
    return res.data.data;
  },

  reactivateBoxSize: async (id: string): Promise<BoxSize> => {
    const res = await api.patch<ApiResponse<BoxSize>>(`/box-sizes/${id}/reactivate`);
    return res.data.data;
  },

  deleteBoxSize: async (id: string, force = false): Promise<void> => {
    await api.delete(`/box-sizes/${id}${force ? '?force=true' : ''}`);
  },

  reorderBoxSizes: async (orderedIds: string[]): Promise<void> => {
    await api.patch('/box-sizes/reorder', { orderedIds });
  },
};

// Named function exports for direct import
export const getBoxSizes = boxSizesApi.getBoxSizes;
export const createBoxSize = boxSizesApi.createBoxSize;
export const updateBoxSize = boxSizesApi.updateBoxSize;
export const deactivateBoxSize = boxSizesApi.deactivateBoxSize;
export const reactivateBoxSize = boxSizesApi.reactivateBoxSize;
export const deleteBoxSize = boxSizesApi.deleteBoxSize;
export const reorderBoxSizes = boxSizesApi.reorderBoxSizes;
