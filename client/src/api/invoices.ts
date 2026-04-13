import api from '@/lib/axios';
import type {
  ApiResponse,
  Invoice,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  GetInvoicesParams,
} from '@/types';

export const invoicesApi = {
  getInvoices: async (params?: GetInvoicesParams): Promise<{ data: Invoice[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } }> => {
    const res = await api.get<{ success: boolean; data: Invoice[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/invoices', { params });
    return {
      data: res.data.data ?? [],
      pagination: {
        total: res.data.pagination?.total ?? 0,
        page: res.data.pagination?.page ?? 1,
        pageSize: res.data.pagination?.limit ?? 25,
        totalPages: res.data.pagination?.totalPages ?? 1,
      },
    };
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const res = await api.get<ApiResponse<Invoice>>(`/invoices/${id}`);
    return res.data.data;
  },

  getNextNumber: async (): Promise<{ nextNumber: string }> => {
    const res = await api.get<ApiResponse<{ nextNumber: string }>>('/invoices/next-number');
    return res.data.data;
  },

  createInvoice: async (data: CreateInvoiceRequest): Promise<Invoice> => {
    const res = await api.post<ApiResponse<Invoice>>('/invoices', data);
    return res.data.data;
  },

  updateInvoice: async (id: string, data: UpdateInvoiceRequest): Promise<Invoice> => {
    const res = await api.put<ApiResponse<Invoice>>(`/invoices/${id}`, data);
    return res.data.data;
  },

  sendInvoice: async (id: string): Promise<Invoice> => {
    const res = await api.patch<ApiResponse<Invoice>>(`/invoices/${id}/send`);
    return res.data.data;
  },

  payInvoice: async (id: string, paidDate?: string): Promise<Invoice> => {
    const res = await api.patch<ApiResponse<Invoice>>(`/invoices/${id}/pay`, { paidDate });
    return res.data.data;
  },

  cancelInvoice: async (id: string): Promise<Invoice> => {
    const res = await api.patch<ApiResponse<Invoice>>(`/invoices/${id}/cancel`);
    return res.data.data;
  },

  deleteInvoice: async (id: string): Promise<void> => {
    await api.delete(`/invoices/${id}`);
  },

  downloadPDF: async (id: string): Promise<Blob> => {
    const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    return res.data;
  },
};
