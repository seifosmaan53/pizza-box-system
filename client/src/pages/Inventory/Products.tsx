import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, X, Save, Package, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '@/api/products';
import { storesApi } from '@/api/stores';
import { usePermissions } from '@/hooks/usePermissions';
import { QUERY_KEYS } from '@/utils/constants';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { downloadCsv } from '@/utils/exportCsv';
import type { Product, ProductStock, Store } from '@/types';

// ─── Stock Panel ──────────────────────────────────────────────────────────────

interface StockPanelProps {
  product: Product;
  onClose: () => void;
  canManage: boolean;
}

function StockPanel({ product, onClose, canManage }: StockPanelProps) {
  const qc = useQueryClient();
  // Track inline editing per store: storeId -> { quantity, threshold }
  const [editingStore, setEditingStore] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editThreshold, setEditThreshold] = useState('');

  const { data: stores } = useQuery({
    queryKey: ['stores', { isActive: true }],
    queryFn: () => storesApi.getStores({ isActive: true, limit: 200 }),
  });

  const { data: stockList, isLoading: stockLoading } = useQuery({
    queryKey: ['product-stock', product.id],
    queryFn: () => productsApi.getProductStock(product.id),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['product-stock', product.id] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['store-product-stock'] });
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.warehouseView] });
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.inventory] });
    qc.invalidateQueries({ queryKey: [QUERY_KEYS.lowStock] });
  };

  const setStockMut = useMutation({
    mutationFn: (data: { storeId: string; quantity: number; lowStockThreshold?: number }) =>
      productsApi.setProductStock(product.id, data),
    onSuccess: () => {
      toast.success('Stock updated');
      invalidateAll();
      setEditingStore(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const storeList: Store[] = stores?.data ?? [];
  const stockMap = new Map<string, ProductStock>((stockList ?? []).map((s) => [s.storeId, s]));

  const startEdit = (storeId: string) => {
    const stock = stockMap.get(storeId);
    setEditingStore(storeId);
    setEditQty(String(stock?.quantity ?? 0));
    setEditThreshold(String(stock?.lowStockThreshold ?? 20));
  };

  const saveEdit = (storeId: string) => {
    setStockMut.mutate({
      storeId,
      quantity: parseInt(editQty, 10) || 0,
      lowStockThreshold: parseInt(editThreshold, 10) || 20,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 shadow-xl h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">{product.name} — Stock</h2>
            <div className="flex items-center gap-3 mt-1">
              {product.sku && <span className="text-xs text-gray-500 dark:text-gray-400">SKU: {product.sku}</span>}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Price: ${parseFloat(product.unitPrice).toFixed(2)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Help text */}
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Click on any store to set or update its stock level. Changes are saved immediately.
          </p>
        </div>

        {/* Store list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {stockLoading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : storeList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No stores found</p>
          ) : (
            storeList.map((store) => {
              const stock = stockMap.get(store.id);
              const qty = stock?.quantity ?? 0;
              const threshold = stock?.lowStockThreshold ?? 20;
              const isLow = qty > 0 && qty <= threshold;
              const isEditing = editingStore === store.id;
              const hasStock = stock !== undefined;

              return (
                <div
                  key={store.id}
                  className={`rounded-lg border transition-all ${
                    isEditing
                      ? 'border-orange-300 dark:border-orange-600 bg-orange-50/50 dark:bg-orange-900/10'
                      : hasStock
                      ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      : 'border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  {isEditing ? (
                    /* Inline editing mode */
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{store.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{[store.city, store.state].filter(Boolean).join(', ') || '—'}</p>
                        </div>
                        <button
                          onClick={() => setEditingStore(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Quantity</label>
                          <input
                            type="number"
                            min={0}
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            autoFocus
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Low Stock Threshold</label>
                          <input
                            type="number"
                            min={0}
                            value={editThreshold}
                            onChange={(e) => setEditThreshold(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => saveEdit(store.id)}
                        disabled={setStockMut.isPending}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {setStockMut.isPending ? 'Saving…' : 'Save Stock'}
                      </button>
                    </div>
                  ) : (
                    /* Display mode — click to edit */
                    <button
                      onClick={() => canManage ? startEdit(store.id) : undefined}
                      className={`w-full p-4 text-left ${canManage ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''} rounded-lg transition-colors`}
                      disabled={!canManage}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{store.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{[store.city, store.state].filter(Boolean).join(', ') || '—'}</p>
                        </div>
                        {hasStock ? (
                          <div className="text-right">
                            <span className={`text-lg font-bold ${
                              qty === 0 ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-gray-900 dark:text-white'
                            }`}>
                              {qty}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">units</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                            {canManage ? 'Click to add stock' : 'No stock'}
                          </span>
                        )}
                      </div>
                      {hasStock && (
                        <div className="mt-1.5 flex items-center gap-3">
                          {qty === 0 && <span className="text-xs text-red-500 font-medium">Out of stock</span>}
                          {isLow && <span className="text-xs text-orange-500 font-medium">Low stock</span>}
                          {!isLow && qty > 0 && <span className="text-xs text-green-600 dark:text-green-400">In stock</span>}
                          <span className="text-xs text-gray-400">Threshold: {threshold}</span>
                        </div>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Total footer */}
        {stockList && stockList.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total across all stores</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {stockList.reduce((sum, s) => sum + s.quantity, 0).toLocaleString()} units
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type FormState = {
  name: string;
  description: string;
  sku: string;
  category: string;
  unitPrice: string;
};

const emptyForm: FormState = { name: '', description: '', sku: '', category: '', unitPrice: '' };

export default function Products() {
  const qc = useQueryClient();
  const { canManageBoxTypes: canManage, isAdmin } = usePermissions();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['products', { includeInactive: showInactive }],
    queryFn: () => productsApi.getProducts({ includeInactive: showInactive }),
  });

  const createMut = useMutation({
    mutationFn: (d: FormState) =>
      productsApi.createProduct({ name: d.name, description: d.description || undefined, sku: d.sku || undefined, category: d.category || undefined, unitPrice: parseFloat(d.unitPrice) }),
    onSuccess: () => {
      toast.success('Product created');
      qc.invalidateQueries({ queryKey: ['products'] });
      setShowModal(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (d: FormState & { id: string }) =>
      productsApi.updateProduct(d.id, { name: d.name, description: d.description || undefined, sku: d.sku || undefined, category: d.category || undefined, unitPrice: parseFloat(d.unitPrice) }),
    onSuccess: () => {
      toast.success('Product updated');
      qc.invalidateQueries({ queryKey: ['products'] });
      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => productsApi.deactivateProduct(id),
    onSuccess: () => { toast.success('Product deactivated'); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => productsApi.reactivateProduct(id),
    onSuccess: () => { toast.success('Product reactivated'); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: () => {
      toast.success('Product deleted');
      qc.invalidateQueries({ queryKey: ['products'] });
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const products: Product[] = (data ?? []).filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? '', sku: p.sku ?? '', category: p.category ?? '', unitPrice: p.unitPrice });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.unitPrice || isNaN(parseFloat(form.unitPrice))) { toast.error('Valid unit price is required'); return; }
    if (editing) {
      updateMut.mutate({ id: editing.id, ...form });
    } else {
      createMut.mutate(form);
    }
  };

  const exportProducts = () => {
    if (!products.length) return;
    const headers = ['Name', 'SKU', 'Category', 'Unit Price', 'Status', 'Total Stock'];
    const rows = products.map((p) => [
      p.name,
      p.sku ?? '',
      p.category ?? '',
      p.unitPrice,
      p.isActive ? 'Active' : 'Inactive',
      String(p.stock?.reduce((sum: number, s: ProductStock) => sum + s.quantity, 0) ?? 0),
    ]);
    downloadCsv(`products-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div>
      <PageHeader
        title="Products"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Products' }]}
        actions={
          <div className="flex gap-2">
            {products.length > 0 && (
              <button
                onClick={exportProducts}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
            {canManage && (
              <Button onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Product
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Search products..."
          aria-label="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 w-64"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-orange-500"
          />
          Show inactive
        </label>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : products.length === 0 ? (
          <EmptyState title="No products" description="Add products to enable generic line items in invoices" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Category</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Price/Unit</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Total Stock</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
                {(canManage || isAdmin) && <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {products.map((p) => {
                const totalStock = (p.stock ?? []).reduce((sum, s) => sum + s.quantity, 0);
                const hasLow = (p.stock ?? []).some(s => s.quantity <= s.lowStockThreshold);
                const noStock = (p.stock ?? []).length === 0;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {p.name}
                      {p.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">{p.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{p.sku || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.category || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                      {parseFloat(p.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {noStock ? (
                        <button
                          onClick={() => setStockProduct(p)}
                          className="text-xs text-orange-500 hover:text-orange-600 font-medium hover:underline"
                        >
                          Set stock →
                        </button>
                      ) : (
                        <button
                          onClick={() => setStockProduct(p)}
                          className="group"
                          title="Click to manage stock"
                        >
                          <span className={`text-lg font-bold ${
                            totalStock === 0 ? 'text-red-500' : hasLow ? 'text-orange-500' : 'text-gray-900 dark:text-white'
                          } group-hover:underline`}>
                            {totalStock.toLocaleString()}
                          </span>
                          {(p.stock ?? []).length > 1 && (
                            <span className="text-xs text-gray-400 ml-1">
                              ({(p.stock ?? []).length} stores)
                            </span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge color={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    {(canManage || isAdmin) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <button
                              onClick={() => openEdit(p)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canManage && (
                            p.isActive ? (
                              <button
                                onClick={() => deactivateMut.mutate(p.id)}
                                className="p-1.5 text-gray-400 hover:text-yellow-600 rounded transition-colors"
                                title="Deactivate"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => reactivateMut.mutate(p.id)}
                                className="p-1.5 text-green-500 hover:text-green-700 rounded transition-colors"
                                title="Reactivate"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteConfirm({ id: p.id, name: p.name })}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal
          title={editing ? 'Edit Product' : 'Add Product'}
          onClose={() => { setShowModal(false); setEditing(null); setForm(emptyForm); }}
        >
          <div className="space-y-4">
            <Input
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Napkins"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Optional description..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SKU"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="e.g. NAP-001"
              />
              <Input
                label="Category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Supplies"
              />
            </div>
            <Input
              label="Price per Unit *"
              type="number"
              min={0}
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              placeholder="0.00"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Button>
              <Button
                loading={createMut.isPending || updateMut.isPending}
                onClick={handleSubmit}
              >
                {editing ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Product"
          description={`Delete "${deleteConfirm.name}"? This cannot be undone.`}
          confirmText="Delete"
          onConfirm={() => deleteMut.mutate(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
          danger
        />
      )}

      {/* Stock panel */}
      {stockProduct && (
        <StockPanel
          product={stockProduct}
          onClose={() => setStockProduct(null)}
          canManage={canManage}
        />
      )}
    </div>
  );
}
