import api from '@/lib/axios';
import type { ApiResponse, BoxType, CreateBoxTypeRequest } from '@/types';

export const boxTypesApi = {
  getBoxTypes: async (includeInactive = false): Promise<BoxType[]> => {
    const res = await api.get<ApiResponse<BoxType[]>>('/box-types', {
      params: { includeInactive },
    });
    return res.data.data;
  },

  createBoxType: async (data: CreateBoxTypeRequest): Promise<BoxType> => {
    const res = await api.post<ApiResponse<BoxType>>('/box-types', data);
    return res.data.data;
  },

  updateBoxType: async (id: string, data: Partial<CreateBoxTypeRequest>): Promise<BoxType> => {
    const res = await api.put<ApiResponse<BoxType>>(`/box-types/${id}`, data);
    return res.data.data;
  },

  deactivateBoxType: async (id: string): Promise<BoxType> => {
    const res = await api.patch<ApiResponse<BoxType>>(`/box-types/${id}/deactivate`);
    return res.data.data;
  },

  reactivateBoxType: async (id: string): Promise<BoxType> => {
    const res = await api.patch<ApiResponse<BoxType>>(`/box-types/${id}/reactivate`);
    return res.data.data;
  },

  deleteBoxType: async (id: string, force = false): Promise<void> => {
    await api.delete(`/box-types/${id}${force ? '?force=true' : ''}`);
  },

  reorderBoxTypes: async (orderedIds: string[]): Promise<void> => {
    await api.patch('/box-types/reorder', { orderedIds });
  },
};

// Named function exports for direct import
export const getBoxTypes = boxTypesApi.getBoxTypes;
export const createBoxType = boxTypesApi.createBoxType;
export const updateBoxType = boxTypesApi.updateBoxType;
export const deactivateBoxType = boxTypesApi.deactivateBoxType;
export const reactivateBoxType = boxTypesApi.reactivateBoxType;
export const deleteBoxType = boxTypesApi.deleteBoxType;
export const reorderBoxTypes = boxTypesApi.reorderBoxTypes;
