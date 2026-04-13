import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Track in-flight refresh promise to avoid parallel refresh calls
let refreshPromise: Promise<string> | null = null;

// Request interceptor — attach Bearer token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 with silent refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Normalize error shape
    const normalized = {
      status: error.response?.status,
      message:
        (error.response?.data as { message?: string })?.message ||
        error.message ||
        'An unexpected error occurred',
      data: error.response?.data,
    };

    // Handle rate limiting with user-friendly message
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers?.['retry-after'];
      normalized.message = retryAfter
        ? `Too many requests. Please wait ${retryAfter} seconds.`
        : normalized.message || 'Too many requests. Please slow down and try again.';
      return Promise.reject(normalized);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Deduplicate concurrent refresh calls
        if (!refreshPromise) {
          refreshPromise = axios
            .post<{ success: boolean; data: { accessToken: string } }>(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
            .then((res) => {
              const newToken = res.data.data.accessToken;
              useAuthStore.getState().setAccessToken(newToken);
              return newToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newToken = await refreshPromise;
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        } else {
          originalRequest.headers = { Authorization: `Bearer ${newToken}` };
        }
        return api(originalRequest);
      } catch {
        // Refresh failed — log out and redirect
        useAuthStore.getState().logout();
        const currentPath = window.location.pathname + window.location.search;
        // Only redirect to internal paths to prevent open redirect
        const safePath = currentPath.startsWith('/') && !currentPath.startsWith('//') ? currentPath : '/';
        window.location.href = `/login?redirect=${encodeURIComponent(safePath)}`;
        return Promise.reject(normalized);
      }
    }

    return Promise.reject(normalized);
  }
);

export default api;
