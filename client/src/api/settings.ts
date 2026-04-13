import api from '@/lib/axios';
import type { ApiResponse, AppSettings, AuditLog, PaginatedResponse, User } from '@/types';

export const settingsApi = {
  getSettings: async (): Promise<AppSettings> => {
    const res = await api.get<ApiResponse<AppSettings>>('/settings');
    return res.data.data;
  },

  updateSettings: async (data: Partial<AppSettings>): Promise<AppSettings> => {
    const res = await api.put<ApiResponse<AppSettings>>('/settings', data);
    return res.data.data;
  },

  getUsers: async (): Promise<User[]> => {
    const res = await api.get<ApiResponse<User[]>>('/users');
    return res.data.data;
  },

  createUser: async (
    data: Pick<User, 'email' | 'firstName' | 'lastName' | 'role'> & { password: string }
  ): Promise<User> => {
    const res = await api.post<ApiResponse<User>>('/users', data);
    return res.data.data;
  },

  updateUser: async (id: string, data: Partial<User>): Promise<User> => {
    const res = await api.put<ApiResponse<User>>(`/users/${id}`, data);
    return res.data.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  getAuditLog: async (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    entity?: string;
    action?: string;
  }): Promise<PaginatedResponse<AuditLog>> => {
    const res = await api.get<ApiResponse<PaginatedResponse<AuditLog>>>('/audit-log', { params });
    return res.data.data;
  },
};

// Named function exports for direct import
export const getSettings = settingsApi.getSettings;
export const updateSettings = settingsApi.updateSettings;
