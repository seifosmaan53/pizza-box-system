import api from '@/lib/axios';
import type {
  ApiResponse,
  PaginatedResponse,
  InventoryItem,
  LowStockItem,
  InventoryTransaction,
  CreateInventoryItemRequest,
  AdjustInventoryRequest,
  WarehouseMatrix,
  WarehouseCell,
  BoxType,
  BoxSize,
} from '@/types';

export interface InventoryParams {
  page?: number;
  limit?: number;
  storeId?: string;
  boxTypeId?: string;
  boxSizeId?: string;
  lowStock?: boolean;
  search?: string;
}

export const inventoryApi = {
  getInventory: async (params?: InventoryParams): Promise<PaginatedResponse<InventoryItem>> => {
    const res = await api.get<ApiResponse<PaginatedResponse<InventoryItem>>>('/inventory', { params });
    return res.data.data;
  },

  getWarehouseView: async (): Promise<WarehouseMatrix> => {
    const res = await api.get<ApiResponse<any[]>>('/inventory/warehouse');
    const raw: any[] = res.data.data ?? [];

    // Server returns [{boxType, boxSize, totalQty, storeBreakdown}]
    // Transform into WarehouseMatrix: {boxTypes[], boxSizes[], cells{}}
    const boxTypesMap = new Map<string, BoxType>();
    const boxSizesMap = new Map<string, BoxSize>();
    const cells: Record<string, Record<string, WarehouseCell>> = {};

    for (const row of raw) {
      const bt = row.boxType as BoxType;
      const bs = row.boxSize as BoxSize;
      if (!boxTypesMap.has(bt.id)) boxTypesMap.set(bt.id, bt);
      if (!boxSizesMap.has(bs.id)) boxSizesMap.set(bs.id, bs);
      if (!cells[bt.id]) cells[bt.id] = {};
      cells[bt.id][bs.id] = {
        boxTypeId: bt.id,
        boxTypeName: bt.name,
        boxSizeId: bs.id,
        boxSizeName: bs.name,
        totalQuantity: row.totalQty ?? 0,
        storeBreakdown: (row.storeBreakdown ?? []).map((s: any) => ({
          storeId: s.storeId,
          storeName: s.storeName,
          quantity: s.qty ?? 0,
        })),
      };
    }

    // Sort box types alphabetically, box sizes by sortOrder
    const boxTypes = Array.from(boxTypesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const boxSizes = Array.from(boxSizesMap.values()).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return { boxTypes, boxSizes, cells };
  },

  getLowStockItems: async (): Promise<LowStockItem[]> => {
    const res = await api.get<ApiResponse<LowStockItem[]>>('/inventory/low-stock');
    return res.data.data;
  },

  getStoreInventory: async (storeId: string): Promise<InventoryItem[]> => {
    const res = await api.get<ApiResponse<InventoryItem[]>>(`/inventory/store/${storeId}`);
    return res.data.data;
  },

  getStoreProductStock: async (storeId: string): Promise<any[]> => {
    const res = await api.get<ApiResponse<any[]>>(`/inventory/store/${storeId}/products`);
    return res.data.data;
  },

  adjustProductStock: async (id: string, data: AdjustInventoryRequest): Promise<any> => {
    const res = await api.patch<ApiResponse<any>>(`/inventory/product-stock/${id}/adjust`, data);
    return res.data.data;
  },

  getItem: async (id: string): Promise<InventoryItem> => {
    const res = await api.get<ApiResponse<InventoryItem>>(`/inventory/${id}`);
    return res.data.data;
  },

  createInventoryItem: async (data: CreateInventoryItemRequest): Promise<InventoryItem> => {
    const res = await api.post<ApiResponse<InventoryItem>>('/inventory', data);
    return res.data.data;
  },

  updateInventoryItem: async (
    id: string,
    data: Partial<CreateInventoryItemRequest>
  ): Promise<InventoryItem> => {
    const res = await api.put<ApiResponse<InventoryItem>>(`/inventory/${id}`, data);
    return res.data.data;
  },

  adjustInventory: async (id: string, data: AdjustInventoryRequest): Promise<InventoryItem> => {
    const res = await api.patch<ApiResponse<InventoryItem>>(`/inventory/${id}/adjust`, data);
    return res.data.data;
  },

  deleteInventoryItem: async (id: string): Promise<void> => {
    await api.delete(`/inventory/${id}`);
  },

  bulkImport: async (file: File): Promise<{ imported: number; errors: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<ApiResponse<{ imported: number; errors: string[] }>>(
      '/inventory/bulk-import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data;
  },

  getItemTransactions: async (
    id: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<InventoryTransaction>> => {
    const res = await api.get<ApiResponse<PaginatedResponse<InventoryTransaction>>>(
      `/inventory/${id}/transactions`,
      { params }
    );
    return res.data.data;
  },

  getWarehouseDrilldown: async (
    boxTypeId: string,
    boxSizeId: string
  ): Promise<InventoryItem[]> => {
    const res = await api.get<ApiResponse<InventoryItem[]>>(
      `/inventory/warehouse/drilldown/${boxTypeId}/${boxSizeId}`
    );
    return res.data.data;
  },
};
