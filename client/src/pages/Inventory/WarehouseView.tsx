import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Warehouse, X, Plus, ArrowRightLeft, Package, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { inventoryApi } from '@/api/inventory';
import { productsApi } from '@/api/products';
import { storesApi } from '@/api/stores';
import { boxTypesApi } from '@/api/boxTypes';
import { boxSizesApi } from '@/api/boxSizes';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { QUERY_KEYS } from '@/utils/constants';
import { cn } from '@/utils/cn';
import { downloadCsv } from '@/utils/exportCsv';
import type { InventoryItem, Product, ApiError } from '@/types';

interface DrilldownCell {
  boxTypeName: string;
  boxSizeName: string;
  boxTypeId: string;
  boxSizeId: string;
  totalQuantity: number;
}

interface AddStockForm {
  storeId: string;
  boxTypeId: string;
  boxSizeId: string;
  quantity: string;
  pricePerUnit: string;
  lowStockThreshold: string;
  notes: string;
}

const defaultForm: AddStockForm = {
  storeId: '',
  boxTypeId: '',
  boxSizeId: '',
  quantity: '0',
  pricePerUnit: '',
  lowStockThreshold: '20',
  notes: '',
};

export default function WarehouseView() {
  const [drilldown, setDrilldown] = useState<DrilldownCell | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AddStockForm>(defaultForm);
  const [formError, setFormError] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: matrix, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.warehouseView],
    queryFn: inventoryApi.getWarehouseView,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products', { includeInactive: false }],
    queryFn: () => productsApi.getProducts({ includeInactive: false }),
  });

  const { data: drilldownData, isLoading: drilldownLoading } = useQuery({
    queryKey: ['warehouse-drilldown', drilldown?.boxTypeId, drilldown?.boxSizeId],
    queryFn: () => inventoryApi.getWarehouseDrilldown(drilldown!.boxTypeId, drilldown!.boxSizeId),
    enabled: !!drilldown,
  });

  const { data: stores } = useQuery({
    queryKey: [QUERY_KEYS.stores],
    queryFn: () => storesApi.getStores({ isActive: true }),
    enabled: addOpen,
  });

  const { data: boxTypes } = useQuery({
    queryKey: [QUERY_KEYS.boxTypes],
    queryFn: () => boxTypesApi.getBoxTypes(false),
    enabled: addOpen,
  });

  const { data: boxSizes } = useQuery({
    queryKey: [QUERY_KEYS.boxSizes],
    queryFn: () => boxSizesApi.getBoxSizes(false),
    enabled: addOpen,
  });

  const addMut = useMutation({
    mutationFn: inventoryApi.createInventoryItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.warehouseView] });
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.inventory] });
      toast.success('Stock added successfully');
      setAddOpen(false);
      setForm(defaultForm);
      setFormError('');
    },
    onError: (err: ApiError) => {
      const msg = (err?.data as { message?: string })?.message || err.message || 'Failed to add stock';
      if (err?.status === 409) {
        setFormError('This store/box type/size combination already exists. Go to Store Inventory to adjust the quantity.');
      } else {
        setFormError(msg);
      }
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const qty = parseInt(form.quantity, 10);
    const price = parseFloat(form.pricePerUnit);
    const threshold = parseInt(form.lowStockThreshold, 10);

    if (!form.storeId || !form.boxTypeId || !form.boxSizeId) {
      setFormError('Please select store, box type, and box size.');
      return;
    }
    if (isNaN(qty) || qty < 0) { setFormError('Quantity must be 0 or more.'); return; }
    if (isNaN(price) || price <= 0) { setFormError('Price per unit must be greater than 0.'); return; }

    addMut.mutate({
      storeId: form.storeId,
      boxTypeId: form.boxTypeId,
      boxSizeId: form.boxSizeId,
      quantity: qty,
      pricePerUnit: price,
      lowStockThreshold: isNaN(threshold) ? 20 : threshold,
      notes: form.notes || undefined,
    });
  };

  const getCellQuantity = (boxTypeId: string, boxSizeId: string): number =>
    matrix?.cells?.[boxTypeId]?.[boxSizeId]?.totalQuantity ?? 0;

  const exportWarehouse = () => {
    if (!matrix) return;
    const sizeNames = matrix.boxSizes.map((s) => s.name);
    const headers = ['Box Type', ...sizeNames, 'Total'];
    const rows = matrix.boxTypes.map((bt) => {
      const qtys = matrix.boxSizes.map((bs) => String(getCellQuantity(bt.id, bs.id)));
      const total = matrix.boxSizes.reduce((sum, bs) => sum + getCellQuantity(bt.id, bs.id), 0);
      return [bt.name, ...qtys, String(total)];
    });
    downloadCsv(`warehouse-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const getCellColor = (qty: number) => {
    if (qty === 0) return 'bg-gray-50 dark:bg-gray-800/30 text-gray-400';
    if (qty < 100) return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';
    if (qty < 500) return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
    return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400';
  };

  return (
    <div className="relative">
      <PageHeader
        title="Warehouse View"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Warehouse View' }]}
        description="Matrix of all box types × sizes across all stores"
        actions={
          <div className="flex gap-2">
            <button
              onClick={exportWarehouse}
              disabled={!matrix || matrix.boxTypes.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={() => navigate('/inventory/stores')}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Store View
            </button>
            <button
              onClick={() => { setForm(defaultForm); setFormError(''); setAddOpen(true); }}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Stock
            </button>
          </div>
        }
      />

      <Card padding={false}>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !matrix?.boxTypes?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Warehouse className="h-12 w-12 opacity-40" />
            <p>No inventory data available</p>
            <button
              onClick={() => { setForm(defaultForm); setFormError(''); setAddOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add first stock item
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/50 sticky left-0 z-10 min-w-[140px]">
                    Box Type / Size
                  </th>
                  {matrix.boxSizes.map((size) => (
                    <th
                      key={size.id}
                      className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/50 min-w-[100px]"
                    >
                      {size.name}
                      {size.dimensions && (
                        <span className="block font-normal text-gray-400 normal-case">{size.dimensions}</span>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/50 min-w-[80px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.boxTypes.map((type) => {
                  const rowTotal = matrix.boxSizes.reduce(
                    (sum, size) => sum + getCellQuantity(type.id, size.id),
                    0
                  );
                  return (
                    <tr
                      key={type.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900 z-10">
                        {type.name}
                        {type.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{type.description}</p>
                        )}
                      </td>
                      {matrix.boxSizes.map((size) => {
                        const qty = getCellQuantity(type.id, size.id);
                        return (
                          <td key={size.id} className="px-2 py-2 text-center">
                            <button
                              onClick={() =>
                                setDrilldown({
                                  boxTypeId: type.id,
                                  boxSizeId: size.id,
                                  boxTypeName: type.name,
                                  boxSizeName: size.name,
                                  totalQuantity: qty,
                                })
                              }
                              className={cn(
                                'w-full px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80 hover:scale-105',
                                getCellColor(qty)
                              )}
                            >
                              {qty > 0 ? qty.toLocaleString() : '—'}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">
                        {rowTotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100 sticky left-0 bg-gray-50 dark:bg-gray-800/50">
                    Total
                  </td>
                  {matrix.boxSizes.map((size) => {
                    const colTotal = matrix.boxTypes.reduce(
                      (sum, type) => sum + getCellQuantity(type.id, size.id),
                      0
                    );
                    return (
                      <td key={size.id} className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">
                        {colTotal.toLocaleString()}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center font-bold text-red-600 dark:text-red-400">
                    {matrix.boxTypes
                      .reduce(
                        (sum, type) =>
                          sum + matrix.boxSizes.reduce((s, size) => s + getCellQuantity(type.id, size.id), 0),
                        0
                      )
                      .toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Color Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-gray-200 dark:bg-gray-700" /> Empty
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-orange-200 dark:bg-orange-800" /> Low (&lt;100)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-yellow-200 dark:bg-yellow-800" /> Medium (&lt;500)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-green-200 dark:bg-green-800" /> Good (500+)
        </span>
      </div>

      {/* Products Inventory */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Package className="h-5 w-5 text-purple-500" />
          Products
        </h2>
        <Card padding={false}>
          {productsLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !products?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <Package className="h-10 w-10 opacity-40" />
              <p className="text-sm">No products yet</p>
              <p className="text-xs opacity-70">Go to Inventory → Products to add products</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Price/Unit</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Store Breakdown</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product: Product) => {
                    const totalStock = (product.stock ?? []).reduce((sum, s) => sum + s.quantity, 0);
                    const hasLowStock = (product.stock ?? []).some(s => s.quantity <= s.lowStockThreshold);
                    return (
                      <tr
                        key={product.id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {product.name}
                          {product.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">{product.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                          {product.sku || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {product.category || '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          ${parseFloat(product.unitPrice).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'text-lg font-bold',
                            totalStock === 0 ? 'text-red-500' : hasLowStock ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'
                          )}>
                            {totalStock.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(product.stock ?? []).length === 0 ? (
                            <span className="text-xs text-gray-400">No stock set</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {(product.stock ?? []).map((s) => (
                                <span
                                  key={s.id}
                                  className={cn(
                                    'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                                    s.quantity <= s.lowStockThreshold
                                      ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                  )}
                                >
                                  {s.store?.name ?? 'Store'}: <strong>{s.quantity}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={4} className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                      Total Products Stock
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-purple-600 dark:text-purple-400">
                      {products.reduce((sum: number, p: Product) =>
                        sum + (p.stock ?? []).reduce((s, st) => s + st.quantity, 0), 0
                      ).toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Drilldown Slide Panel */}
      {drilldown && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDrilldown(null)} />
          <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {drilldown.boxTypeName} – {drilldown.boxSizeName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Store breakdown</p>
              </div>
              <button
                onClick={() => setDrilldown(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total across all stores</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {drilldown.totalQuantity.toLocaleString()}
                </p>
              </div>
              {drilldownLoading ? (
                <div className="space-y-3">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (drilldownData ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No store data</p>
              ) : (
                <div className="space-y-2">
                  {(drilldownData as InventoryItem[])
                    .sort((a, b) => b.quantity - a.quantity)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {s.store?.name ?? s.storeId}
                          </p>
                          <p className="text-xs text-gray-400">${parseFloat(s.pricePerUnit).toFixed(2)}/unit</p>
                          {s.quantity <= s.lowStockThreshold && (
                            <Badge color="orange" size="sm">Low stock</Badge>
                          )}
                        </div>
                        <span className={cn(
                          'text-lg font-bold',
                          s.quantity <= s.lowStockThreshold
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-gray-900 dark:text-gray-100'
                        )}>
                          {s.quantity}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add Stock Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => { setAddOpen(false); setFormError(''); }}
        title="Add Stock"
        size="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Store <span className="text-red-500">*</span>
              </label>
              <select
                value={form.storeId}
                onChange={e => setForm(f => ({ ...f, storeId: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                <option value="">Select store…</option>
                {stores?.data?.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Box Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.boxTypeId}
                  onChange={e => setForm(f => ({ ...f, boxTypeId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="">Select type…</option>
                  {boxTypes?.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Box Size <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.boxSizeId}
                  onChange={e => setForm(f => ({ ...f, boxSizeId: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="">Select size…</option>
                  {boxSizes?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.dimensions ? ` (${s.dimensions})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price/Unit <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.pricePerUnit}
                  onChange={e => setForm(f => ({ ...f, pricePerUnit: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Low Stock At
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.lowStockThreshold}
                  onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="Optional notes…"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setAddOpen(false); setFormError(''); }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMut.isPending}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {addMut.isPending ? 'Adding…' : 'Add Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
