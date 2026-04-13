import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Minus, Edit2, AlertTriangle, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/api/inventory';
import { storesApi } from '@/api/stores';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { QUERY_KEYS } from '@/utils/constants';
import { cn } from '@/utils/cn';
import { downloadCsv } from '@/utils/exportCsv';
import type { InventoryItem, ProductStock, ApiError } from '@/types';

// Unified row type for both box inventory items and product stock items
interface UnifiedRow {
  id: string;
  kind: 'box' | 'product';
  name: string;
  detail: string;
  quantity: number;
  lowStockThreshold: number;
  pricePerUnit: string;
  // original data for box items (needed for delete confirm)
  boxItem?: InventoryItem;
  // original product stock data
  productStockItem?: ProductStock;
}

interface AdjustForm {
  type: 'MANUAL_ADD' | 'MANUAL_REMOVE' | 'ADJUSTMENT';
  quantityChange: string;
  note: string;
}

export default function StoreInventory() {
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [adjustRow, setAdjustRow] = useState<UnifiedRow | null>(null);
  const [adjustForm, setAdjustForm] = useState<AdjustForm>({ type: 'MANUAL_ADD', quantityChange: '', note: '' });
  const [adjustError, setAdjustError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<InventoryItem | null>(null);
  const qc = useQueryClient();
  const { canAdjustInventory, canDeleteInventoryItem } = usePermissions();

  const { data: stores } = useQuery({
    queryKey: [QUERY_KEYS.stores],
    queryFn: () => storesApi.getStores({ isActive: true }),
  });

  const { data: boxItems, isLoading: boxLoading } = useQuery({
    queryKey: ['store-inventory', selectedStoreId],
    queryFn: () => inventoryApi.getStoreInventory(selectedStoreId),
    enabled: !!selectedStoreId,
  });

  const { data: productStockItems, isLoading: productLoading } = useQuery({
    queryKey: ['store-product-stock', selectedStoreId],
    queryFn: () => inventoryApi.getStoreProductStock(selectedStoreId),
    enabled: !!selectedStoreId,
  });

  const isLoading = boxLoading || productLoading;

  // Build unified rows
  const unifiedRows: UnifiedRow[] = [];

  if (boxItems) {
    for (const item of boxItems) {
      unifiedRows.push({
        id: item.id,
        kind: 'box',
        name: item.boxType?.name ?? '—',
        detail: item.boxSize?.name ?? '—',
        quantity: item.quantity,
        lowStockThreshold: item.lowStockThreshold,
        pricePerUnit: item.pricePerUnit,
        boxItem: item,
      });
    }
  }

  if (productStockItems) {
    for (const ps of productStockItems) {
      unifiedRows.push({
        id: ps.id,
        kind: 'product',
        name: ps.product?.name ?? '—',
        detail: ps.product?.sku ? `SKU: ${ps.product.sku}` : (ps.product?.category ?? '—'),
        quantity: ps.quantity,
        lowStockThreshold: ps.lowStockThreshold,
        pricePerUnit: ps.product?.unitPrice ?? '0',
        productStockItem: ps,
      });
    }
  }

  const selectedStoreName = stores?.data.find((s) => s.id === selectedStoreId)?.name ?? 'store';

  const exportStoreInventory = () => {
    if (!unifiedRows.length) return;
    const headers = ['Type', 'Name', 'Detail', 'Quantity', 'Low Stock Threshold', 'Price/Unit'];
    const rows = unifiedRows.map((r) => [
      r.kind === 'box' ? 'Box' : 'Product',
      r.name,
      r.detail,
      String(r.quantity),
      String(r.lowStockThreshold),
      r.pricePerUnit,
    ]);
    const safeName = selectedStoreName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    downloadCsv(`inventory-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['store-inventory', selectedStoreId] });
    qc.invalidateQueries({ queryKey: ['store-product-stock', selectedStoreId] });
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.warehouseView] });
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.inventory] });
  };

  const adjustBoxMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof inventoryApi.adjustInventory>[1] }) =>
      inventoryApi.adjustInventory(id, data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Inventory adjusted');
      setAdjustRow(null);
    },
    onError: (err: ApiError) => {
      const msg = err.message || 'Failed to adjust inventory';
      setAdjustError(msg);
    },
  });

  const adjustProductMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof inventoryApi.adjustProductStock>[1] }) =>
      inventoryApi.adjustProductStock(id, data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Product stock adjusted');
      setAdjustRow(null);
    },
    onError: (err: ApiError) => {
      const msg = err.message || 'Failed to adjust product stock';
      setAdjustError(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteInventoryItem(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Inventory item deleted');
      setDeleteConfirm(null);
    },
    onError: (err: ApiError) => {
      const msg = err.message || 'Failed to delete inventory item';
      toast.error(msg);
      setDeleteConfirm(null);
    },
  });

  const isPending = adjustBoxMut.isPending || adjustProductMut.isPending;

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError('');
    if (!adjustRow) return;

    const inputVal = parseInt(adjustForm.quantityChange, 10);
    if (isNaN(inputVal) || inputVal < 0) {
      setAdjustError('Please enter a valid quantity.');
      return;
    }

    let signedChange: number;
    if (adjustForm.type === 'ADJUSTMENT') {
      signedChange = inputVal - adjustRow.quantity;
      if (signedChange === 0) {
        setAdjustError('New quantity is the same as the current quantity.');
        return;
      }
    } else if (adjustForm.type === 'MANUAL_REMOVE') {
      if (inputVal === 0) { setAdjustError('Enter a quantity greater than 0.'); return; }
      signedChange = -inputVal;
    } else {
      if (inputVal === 0) { setAdjustError('Enter a quantity greater than 0.'); return; }
      signedChange = inputVal;
    }

    const payload = {
      id: adjustRow.id,
      data: {
        type: adjustForm.type,
        quantityChange: signedChange,
        note: adjustForm.note || undefined,
      },
    };

    if (adjustRow.kind === 'box') {
      adjustBoxMut.mutate(payload);
    } else {
      adjustProductMut.mutate(payload);
    }
  };

  const openAdjust = (row: UnifiedRow, type: 'MANUAL_ADD' | 'MANUAL_REMOVE') => {
    setAdjustRow(row);
    setAdjustForm({ type, quantityChange: '', note: '' });
    setAdjustError('');
  };

  const selectedStore = stores?.data.find(s => s.id === selectedStoreId);

  const lowStockRows = unifiedRows.filter(r => r.quantity <= r.lowStockThreshold);
  const totalQty = unifiedRows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div>
      <PageHeader
        title="Store Inventory"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Store View' }]}
        description="View and manage all inventory for a specific store"
        actions={selectedStoreId && unifiedRows.length > 0 ? (
          <button
            onClick={exportStoreInventory}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        ) : undefined}
      />

      {/* Store selector */}
      <div className="mb-6">
        <select
          value={selectedStoreId}
          onChange={e => setSelectedStoreId(e.target.value)}
          aria-label="Select store"
          className="w-full max-w-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-gray-100"
        >
          <option value="">Select a store…</option>
          {stores?.data.map(s => (
            <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>
          ))}
        </select>
      </div>

      {!selectedStoreId ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <Package className="h-12 w-12 opacity-40" />
            <p className="text-sm">Select a store to view its inventory</p>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <>
          {/* Summary row */}
          {unifiedRows.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Items</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{unifiedRows.length}</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Quantity</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalQty.toLocaleString()}</p>
              </Card>
              <Card>
                <p className="text-xs text-gray-500 dark:text-gray-400">Low Stock Alerts</p>
                <p className={cn('text-2xl font-bold mt-1', lowStockRows.length > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100')}>
                  {lowStockRows.length}
                </p>
              </Card>
            </div>
          )}

          <Card padding={false}>
            {unifiedRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <Package className="h-10 w-10 opacity-40" />
                <p className="text-sm">No inventory items for {selectedStore?.name}</p>
                <p className="text-xs opacity-70">Use "Add Stock" on the Warehouse View or add Products to this store</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Detail</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Low Stock At</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Price/Unit</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedRows.map((row) => {
                      const isLow = row.quantity <= row.lowStockThreshold;
                      return (
                        <tr
                          key={`${row.kind}-${row.id}`}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                        >
                          <td className="px-4 py-3">
                            <Badge color={row.kind === 'box' ? 'blue' : 'purple'} size="sm">
                              {row.kind === 'box' ? 'Box' : 'Product'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {row.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {row.detail}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              'text-lg font-bold',
                              isLow ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'
                            )}>
                              {row.quantity.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                            {row.lowStockThreshold}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                            ${parseFloat(row.pricePerUnit).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isLow ? (
                              <Badge color="orange" size="sm">
                                <AlertTriangle className="h-3 w-3 mr-1 inline" />
                                Low
                              </Badge>
                            ) : (
                              <Badge color="green" size="sm">OK</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              {canAdjustInventory && (
                                <>
                                  <button
                                    onClick={() => openAdjust(row, 'MANUAL_ADD')}
                                    title="Add stock"
                                    className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => openAdjust(row, 'MANUAL_REMOVE')}
                                    title="Remove stock"
                                    className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => { setAdjustRow(row); setAdjustForm({ type: 'ADJUSTMENT', quantityChange: String(row.quantity), note: '' }); setAdjustError(''); }}
                                    title="Set exact quantity"
                                    className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {canDeleteInventoryItem && row.kind === 'box' && row.boxItem && (
                                <button
                                  onClick={() => setDeleteConfirm(row.boxItem!)}
                                  title="Delete item"
                                  className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Adjust Quantity Modal */}
      <Modal
        isOpen={!!adjustRow}
        onClose={() => { setAdjustRow(null); setAdjustError(''); }}
        title={
          adjustForm.type === 'MANUAL_ADD' ? 'Add Stock' :
          adjustForm.type === 'MANUAL_REMOVE' ? 'Remove Stock' : 'Set Quantity'
        }
        size="sm"
      >
        {adjustRow && (
          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Badge color={adjustRow.kind === 'box' ? 'blue' : 'purple'} size="sm">
                  {adjustRow.kind === 'box' ? 'Box' : 'Product'}
                </Badge>
              </div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {adjustRow.name} – {adjustRow.detail}
              </p>
              <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                Current quantity: <strong>{adjustRow.quantity}</strong>
              </p>
            </div>

            {adjustError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                {adjustError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {adjustForm.type === 'ADJUSTMENT' ? 'New Quantity' : 'Quantity to ' + (adjustForm.type === 'MANUAL_ADD' ? 'Add' : 'Remove')}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={adjustForm.quantityChange}
                onChange={e => setAdjustForm(f => ({ ...f, quantityChange: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Note
              </label>
              <input
                type="text"
                value={adjustForm.note}
                onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Optional reason…"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setAdjustRow(null); setAdjustError(''); }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  'px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50',
                  adjustForm.type === 'MANUAL_REMOVE'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                )}
              >
                {isPending ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Inventory Item"
          description={`Delete "${deleteConfirm.boxType?.name} – ${deleteConfirm.boxSize?.name}" from ${selectedStore?.name}? This cannot be undone. Items referenced in active invoices cannot be deleted.`}
          confirmText="Delete"
          onConfirm={() => deleteMut.mutate(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
          isLoading={deleteMut.isPending}
          danger
        />
      )}
    </div>
  );
}
