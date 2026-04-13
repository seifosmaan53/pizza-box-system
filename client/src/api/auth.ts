import api from '@/lib/axios';
import type { ApiResponse, LoginRequest, LoginResponse, User } from '@/types';

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', data);
    return res.data.data;
  },

  refresh: async (): Promise<{ accessToken: string }> => {
    const res = await api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh');
    return res.data.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  forgotPassword: async (email: string): Promise<{ message: string; resetLink?: string }> => {
    const res = await api.post('/auth/forgot-password', { email });
    return { message: res.data.message, resetLink: res.data.data?.resetLink };
  },

  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/auth/reset-password/${token}`, {
      password,
    });
    return res.data.data;
  },

  getMe: async (): Promise<User> => {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    return res.data.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const res = await api.post<ApiResponse<{ message: string }>>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return res.data.data;
  },

  updateProfile: async (data: { firstName?: string; lastName?: string }): Promise<User> => {
    const res = await api.put<ApiResponse<User>>('/auth/profile', data);
    return res.data.data;
  },
};
