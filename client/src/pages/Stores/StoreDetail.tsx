import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  MapPin, Mail, Phone, User, Package, FileText,
  BarChart2, Activity, Edit, Trash2, ArrowLeft,
  Plus, Minus, ChevronUp, ChevronDown, Check, Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { storesApi } from '@/api/stores';
import { inventoryApi } from '@/api/inventory';
import { productsApi } from '@/api/products';
import { invoicesApi } from '@/api/invoices';
import { analyticsApi } from '@/api/analytics';
import { boxTypesApi } from '@/api/boxTypes';
import { boxSizesApi } from '@/api/boxSizes';
import { queryClient } from '@/lib/queryClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { StoreForm, type StoreFormData } from './StoreForm';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/utils/formatters';
import { QUERY_KEYS, US_STATES } from '@/utils/constants';
import { usePermissions } from '@/hooks/usePermissions';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const TABS = [
  { id: 'overview', label: 'Overview', icon: <User className="h-4 w-4" /> },
  { id: 'inventory', label: 'Inventory', icon: <Package className="h-4 w-4" /> },
  { id: 'invoices', label: 'Invoices', icon: <FileText className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="h-4 w-4" /> },
  { id: 'activity', label: 'Activity', icon: <Activity className="h-4 w-4" /> },
];

type SortField = 'boxType' | 'boxSize' | 'quantity' | 'lowStockThreshold' | 'pricePerUnit';
type SortDir = 'asc' | 'desc';

interface AddInventoryForm {
  boxTypeId: string;
  boxSizeId: string;
  quantity: number;
  pricePerUnit: number;
  lowStockThreshold: number;
}

const INITIAL_ADD_FORM: AddInventoryForm = {
  boxTypeId: '',
  boxSizeId: '',
  quantity: 0,
  pricePerUnit: 0,
  lowStockThreshold: 10,
};

export default function StoreDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const perms = usePermissions();
  const [activeTab, setActiveTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Inventory tab state
  const [addInventoryOpen, setAddInventoryOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddInventoryForm>(INITIAL_ADD_FORM);
  const [sortField, setSortField] = useState<SortField>('boxType');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [editingThresholdValue, setEditingThresholdValue] = useState<number>(0);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>('');
  const [editingQtyKind, setEditingQtyKind] = useState<'box' | 'product'>('box');

  // Product stock state
  const [addProductStockOpen, setAddProductStockOpen] = useState(false);
  const [addPsForm, setAddPsForm] = useState({ productId: '', quantity: 0, lowStockThreshold: 20 });

  const { data: store, isLoading } = useQuery({
    queryKey: QUERY_KEYS.store(id!),
    queryFn: () => storesApi.getStore(id!),
    enabled: !!id,
  });

  const { data: summary } = useQuery({
    queryKey: QUERY_KEYS.storeSummary(id!),
    queryFn: () => storesApi.getStoreSummary(id!),
    enabled: !!id,
  });

  const { data: inventory } = useQuery({
    queryKey: [QUERY_KEYS.inventory, 'store', id],
    queryFn: () => inventoryApi.getStoreInventory(id!),
    enabled: !!id && activeTab === 'inventory',
  });

  const { data: productStock } = useQuery({
    queryKey: [QUERY_KEYS.inventory, 'store', id, 'products'],
    queryFn: () => inventoryApi.getStoreProductStock(id!),
    enabled: !!id && activeTab === 'inventory',
  });

  const { data: boxTypes } = useQuery({
    queryKey: [QUERY_KEYS.boxTypes],
    queryFn: () => boxTypesApi.getBoxTypes(),
    enabled: activeTab === 'inventory',
  });

  const { data: boxSizes } = useQuery({
    queryKey: [QUERY_KEYS.boxSizes],
    queryFn: () => boxSizesApi.getBoxSizes(),
    enabled: activeTab === 'inventory',
  });

  const { data: allProducts } = useQuery({
    queryKey: ['products', { includeInactive: false }],
    queryFn: () => productsApi.getProducts({ includeInactive: false }),
    enabled: activeTab === 'inventory',
  });

  const { data: invoices } = useQuery({
    queryKey: [QUERY_KEYS.invoices, 'store', id],
    queryFn: () => invoicesApi.getInvoices({ storeId: id, limit: 20 }),
    enabled: !!id && activeTab === 'invoices',
  });

  const { data: analytics } = useQuery({
    queryKey: [QUERY_KEYS.revenueOverTime, id],
    queryFn: () => analyticsApi.getRevenueOverTime({ storeId: id }),
    enabled: !!id && activeTab === 'analytics',
  });

  const updateMutation = useMutation({
    mutationFn: (data: StoreFormData) => storesApi.updateStore(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.store(id!) });
      setEditOpen(false);
      toast.success('Store updated');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => storesApi.deleteStore(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.stores] });
      navigate('/stores');
      toast.success('Store deleted');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed'),
  });

  const invalidateInventory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.inventory, 'store', id] });
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.inventory, 'store', id, 'products'] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storeSummary(id!) });
  }, [id]);

  const createInventoryMutation = useMutation({
    mutationFn: (data: AddInventoryForm) =>
      inventoryApi.createInventoryItem({
        storeId: id!,
        boxTypeId: data.boxTypeId,
        boxSizeId: data.boxSizeId,
        quantity: data.quantity,
        pricePerUnit: data.pricePerUnit,
        lowStockThreshold: data.lowStockThreshold,
      }),
    onSuccess: () => {
      invalidateInventory();
      setAddInventoryOpen(false);
      setAddForm(INITIAL_ADD_FORM);
      toast.success('Inventory item added');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed to add inventory item'),
  });

  const updateInventoryMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Record<string, unknown> }) =>
      inventoryApi.updateInventoryItem(itemId, data),
    onSuccess: () => {
      invalidateInventory();
      toast.success('Updated');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Update failed'),
  });

  const adjustInventoryMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { type: 'MANUAL_ADD' | 'MANUAL_REMOVE'; quantityChange: number; note: string } }) =>
      inventoryApi.adjustInventory(itemId, data),
    onSuccess: () => {
      invalidateInventory();
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Adjustment failed'),
  });

  const adjustProductStockMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { type: 'MANUAL_ADD' | 'MANUAL_REMOVE' | 'ADJUSTMENT'; quantityChange: number; note: string } }) =>
      inventoryApi.adjustProductStock(itemId, data),
    onSuccess: () => {
      invalidateInventory();
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Adjustment failed'),
  });

  const addProductStockMutation = useMutation({
    mutationFn: (data: { productId: string; storeId: string; quantity: number; lowStockThreshold: number }) =>
      productsApi.setProductStock(data.productId, { storeId: data.storeId, quantity: data.quantity, lowStockThreshold: data.lowStockThreshold }),
    onSuccess: () => {
      invalidateInventory();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setAddProductStockOpen(false);
      setAddPsForm({ productId: '', quantity: 0, lowStockThreshold: 20 });
      toast.success('Product stock added');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed to add product stock'),
  });

  // ─── Debounced +/- for product stock ──────────────────────────────────────
  const productDeltasRef = useRef<Record<string, number>>({});
  const productTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [productDeltas, setProductDeltas] = useState<Record<string, number>>({});

  const flushProductDelta = useCallback((psId: string) => {
    const delta = productDeltasRef.current[psId];
    if (!delta) return;
    const type = delta > 0 ? 'MANUAL_ADD' as const : 'MANUAL_REMOVE' as const;
    adjustProductStockMutation.mutate({
      itemId: psId,
      data: { type, quantityChange: Math.abs(delta), note: `Manual ${type === 'MANUAL_ADD' ? 'addition' : 'removal'} of ${Math.abs(delta)} from store detail` },
    });
    delete productDeltasRef.current[psId];
    setProductDeltas((prev) => { const next = { ...prev }; delete next[psId]; return next; });
  }, [adjustProductStockMutation]);

  const handleProductAdjust = useCallback((psId: string, type: 'MANUAL_ADD' | 'MANUAL_REMOVE') => {
    const change = type === 'MANUAL_ADD' ? 1 : -1;
    productDeltasRef.current[psId] = (productDeltasRef.current[psId] ?? 0) + change;
    setProductDeltas((prev) => ({ ...prev, [psId]: productDeltasRef.current[psId] }));
    if (productTimersRef.current[psId]) clearTimeout(productTimersRef.current[psId]);
    productTimersRef.current[psId] = setTimeout(() => flushProductDelta(psId), 800);
  }, [flushProductDelta]);

  const handleAddProductStockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPsForm.productId) {
      toast.error('Please select a product');
      return;
    }
    addProductStockMutation.mutate({ ...addPsForm, storeId: id! });
  };

  // Sorting logic
  const handleSort = useCallback((field: SortField) => {
    setSortDir((prev) => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortField(field);
  }, [sortField]);

  const sortedInventory = useMemo(() => {
    if (!inventory) return [];
    const items = [...inventory];
    items.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortField) {
        case 'boxType':
          aVal = a.boxType?.name ?? '';
          bVal = b.boxType?.name ?? '';
          break;
        case 'boxSize':
          aVal = a.boxSize?.name ?? '';
          bVal = b.boxSize?.name ?? '';
          break;
        case 'quantity':
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        case 'lowStockThreshold':
          aVal = a.lowStockThreshold;
          bVal = b.lowStockThreshold;
          break;
        case 'pricePerUnit':
          aVal = a.pricePerUnit != null ? parseFloat(a.pricePerUnit) : 0;
          bVal = b.pricePerUnit != null ? parseFloat(b.pricePerUnit) : 0;
          break;
        default:
          return 0;
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal as string);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return items;
  }, [inventory, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-red-500" />
      : <ChevronDown className="h-3 w-3 text-red-500" />;
  };

  // Inline threshold editing
  const startEditThreshold = (itemId: string, currentValue: number) => {
    setEditingThresholdId(itemId);
    setEditingThresholdValue(currentValue);
  };

  const saveThreshold = () => {
    if (editingThresholdId) {
      updateInventoryMutation.mutate({
        itemId: editingThresholdId,
        data: { lowStockThreshold: editingThresholdValue },
      });
      setEditingThresholdId(null);
    }
  };

  // ─── Debounced +/- for box inventory ──────────────────────────────────────
  const boxDeltasRef = useRef<Record<string, number>>({});
  const boxTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [boxDeltas, setBoxDeltas] = useState<Record<string, number>>({});

  const flushBoxDelta = useCallback((itemId: string) => {
    const delta = boxDeltasRef.current[itemId];
    if (!delta) return;
    const type = delta > 0 ? 'MANUAL_ADD' as const : 'MANUAL_REMOVE' as const;
    adjustInventoryMutation.mutate({
      itemId,
      data: { type, quantityChange: Math.abs(delta), note: `Manual ${type === 'MANUAL_ADD' ? 'addition' : 'removal'} of ${Math.abs(delta)} from store detail` },
    });
    delete boxDeltasRef.current[itemId];
    setBoxDeltas((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
  }, [adjustInventoryMutation]);

  const handleAdjust = useCallback((itemId: string, type: 'MANUAL_ADD' | 'MANUAL_REMOVE') => {
    const change = type === 'MANUAL_ADD' ? 1 : -1;
    boxDeltasRef.current[itemId] = (boxDeltasRef.current[itemId] ?? 0) + change;
    setBoxDeltas((prev) => ({ ...prev, [itemId]: boxDeltasRef.current[itemId] }));
    if (boxTimersRef.current[itemId]) clearTimeout(boxTimersRef.current[itemId]);
    boxTimersRef.current[itemId] = setTimeout(() => flushBoxDelta(itemId), 800);
  }, [flushBoxDelta]);

  // ─── Direct quantity edit (click the number to type a new value) ──────────
  const startEditQty = (id: string, currentQty: number, kind: 'box' | 'product') => {
    // Flush any pending delta for this item first
    if (kind === 'box' && boxTimersRef.current[id]) {
      clearTimeout(boxTimersRef.current[id]);
      delete boxDeltasRef.current[id];
      setBoxDeltas((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
    if (kind === 'product' && productTimersRef.current[id]) {
      clearTimeout(productTimersRef.current[id]);
      delete productDeltasRef.current[id];
      setProductDeltas((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
    setEditingQtyId(id);
    setEditingQtyValue(String(currentQty));
    setEditingQtyKind(kind);
  };

  const saveEditQty = (itemId: string, originalQty: number) => {
    const newQty = parseInt(editingQtyValue, 10);
    setEditingQtyId(null);
    if (isNaN(newQty) || newQty < 0 || newQty === originalQty) return;
    const delta = newQty - originalQty;
    const type = delta > 0 ? 'MANUAL_ADD' as const : 'MANUAL_REMOVE' as const;
    const mutation = editingQtyKind === 'box' ? adjustInventoryMutation : adjustProductStockMutation;
    mutation.mutate({
      itemId,
      data: { type, quantityChange: Math.abs(delta), note: `Set quantity to ${newQty} from store detail` },
    });
  };

  const handleAddFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.boxTypeId || !addForm.boxSizeId) {
      toast.error('Please select box type and size');
      return;
    }
    createInventoryMutation.mutate(addForm);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="text-center py-20 text-gray-400">
        Store not found.{' '}
        <Link to="/stores" className="text-red-600">Go back</Link>
      </div>
    );
  }

  const stateName = US_STATES.find((s) => s.code === store.state)?.name;

  const sortableColumns: { label: string; field: SortField }[] = [
    { label: 'Box Type', field: 'boxType' },
    { label: 'Box Size', field: 'boxSize' },
    { label: 'Quantity', field: 'quantity' },
    { label: 'Min Stock', field: 'lowStockThreshold' },
    { label: 'Unit Cost', field: 'pricePerUnit' },
  ];

  return (
    <div>
      <PageHeader
        title={store.name}
        breadcrumbs={[{ label: 'Stores', href: '/stores' }, { label: store.name }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge color={store.isActive ? 'green' : 'gray'} dot>
              {store.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {perms.canEditStore && (
              <Button size="sm" variant="secondary" leftIcon={<Edit className="h-3.5 w-3.5" />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            )}
            {perms.canDeleteStore && (
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            )}
          </div>
        }
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: formatCurrency(summary?.totalRevenue ?? 0) },
          { label: 'Outstanding', value: formatCurrency(summary?.outstandingAmount ?? 0) },
          { label: 'Total Invoices', value: String(summary?.totalInvoices ?? 0) },
          { label: 'Low Stock Items', value: String(summary?.lowStockCount ?? 0) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{kpi.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} className="mb-4" />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card header={<h3 className="font-semibold text-gray-900 dark:text-gray-100">Store Information</h3>}>
            <dl className="space-y-3">
              <div className="flex gap-3">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Address</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">
                    {[store.address, store.city, stateName, store.zipCode].filter(Boolean).join(', ') || '—'}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Contact</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100">{store.contactName || '—'}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Mail className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Email</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    {store.email || '—'}
                    {store.email && (
                      <button onClick={() => { navigator.clipboard.writeText(store.email!); toast.success('Email copied'); }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Copy email" title="Copy email">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Phone className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">Phone</dt>
                  <dd className="text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    {store.phone || '—'}
                    {store.phone && (
                      <button onClick={() => { navigator.clipboard.writeText(store.phone!); toast.success('Phone copied'); }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Copy phone" title="Copy phone">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </dd>
                </div>
              </div>
            </dl>
          </Card>

          <Card header={<h3 className="font-semibold text-gray-900 dark:text-gray-100">Quick Stats</h3>}>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Inventory Items</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{summary?.inventoryItemCount ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Total Boxes</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{summary?.totalQuantity?.toLocaleString() ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="text-sm text-gray-600 dark:text-gray-400">{formatDate(store.createdAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Box Inventory */}
          <Card
            padding={false}
            header={
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Inventory</h3>
                <Button
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => setAddInventoryOpen(true)}
                >
                  Add Inventory Item
                </Button>
              </div>
            }
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {sortableColumns.map((col) => (
                    <th
                      key={col.field}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none group"
                      onClick={() => handleSort(col.field)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.field} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedInventory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No inventory items yet. Click "Add Inventory Item" to get started.
                    </td>
                  </tr>
                )}
                {sortedInventory.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3">{item.boxType?.name ?? '—'}</td>
                    <td className="px-4 py-3">{item.boxSize?.name ?? '—'}</td>
                    {/* Inline editable quantity with +/- buttons */}
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          className="h-6 w-6 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-40"
                          onClick={() => handleAdjust(item.id, 'MANUAL_REMOVE')}
                          disabled={item.quantity + (boxDeltas[item.id] ?? 0) <= 0}
                          title="Remove 1"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        {editingQtyId === item.id ? (
                          <input
                            type="number"
                            min={0}
                            autoFocus
                            className="w-16 rounded border border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-sm text-center text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editingQtyValue}
                            onChange={(e) => setEditingQtyValue(e.target.value)}
                            onBlur={() => saveEditQty(item.id, item.quantity)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditQty(item.id, item.quantity);
                              if (e.key === 'Escape') setEditingQtyId(null);
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditQty(item.id, item.quantity + (boxDeltas[item.id] ?? 0), 'box')}
                            className={`min-w-[2rem] text-center cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded px-1 ${(item.quantity + (boxDeltas[item.id] ?? 0)) <= item.lowStockThreshold ? 'text-orange-600 font-semibold' : ''} ${boxDeltas[item.id] ? 'text-blue-600 dark:text-blue-400' : ''}`}
                            title="Click to edit quantity"
                          >
                            {item.quantity + (boxDeltas[item.id] ?? 0)}
                          </button>
                        )}
                        <button
                          type="button"
                          className="h-6 w-6 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-40"
                          onClick={() => handleAdjust(item.id, 'MANUAL_ADD')}
                          title="Add 1"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    {/* Inline editable low-stock threshold */}
                    <td className="px-4 py-3 text-gray-500">
                      {editingThresholdId === item.id ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            className="w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                            value={editingThresholdValue}
                            onChange={(e) => setEditingThresholdValue(Number(e.target.value))}
                            onBlur={saveThreshold}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveThreshold();
                              if (e.key === 'Escape') setEditingThresholdId(null);
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            className="text-green-600 hover:text-green-700"
                            onClick={saveThreshold}
                            title="Save"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 hover:underline decoration-dashed underline-offset-2"
                          onClick={() => startEditThreshold(item.id, item.lowStockThreshold)}
                          title="Click to edit threshold"
                        >
                          {item.lowStockThreshold}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.pricePerUnit != null ? formatCurrency(parseFloat(item.pricePerUnit)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Product Stock Section */}
          <Card
            padding={false}
            header={
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Product Stock</h3>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => setAddProductStockOpen(true)}
                >
                  Add Product Stock
                </Button>
              </div>
            }
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['Product', 'SKU', 'Category', 'Quantity', 'Min Stock', 'Price/Unit'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(!productStock || productStock.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No product stock for this store. Click "Add Product Stock" to get started.
                    </td>
                  </tr>
                ) : (
                  productStock.map((ps: { id: string; productId: string; product?: { name: string; sku?: string | null; category?: string | null; isActive?: boolean; unitPrice?: string }; quantity: number; lowStockThreshold: number }) => (
                    <tr key={ps.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {ps.product?.name ?? '—'}
                        {ps.product?.isActive === false && (
                          <Badge color="gray" size="sm" className="ml-2">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{ps.product?.sku ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{ps.product?.category ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            className="h-6 w-6 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-40"
                            onClick={() => handleProductAdjust(ps.id, 'MANUAL_REMOVE')}
                            disabled={ps.quantity + (productDeltas[ps.id] ?? 0) <= 0}
                            title="Remove 1"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          {editingQtyId === ps.id ? (
                            <input
                              type="number"
                              min={0}
                              autoFocus
                              className="w-16 rounded border border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-sm text-center text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value={editingQtyValue}
                              onChange={(e) => setEditingQtyValue(e.target.value)}
                              onBlur={() => saveEditQty(ps.id, ps.quantity)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditQty(ps.id, ps.quantity);
                                if (e.key === 'Escape') setEditingQtyId(null);
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditQty(ps.id, ps.quantity + (productDeltas[ps.id] ?? 0), 'product')}
                              className={`min-w-[2rem] text-center cursor-text hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded px-1 ${(ps.quantity + (productDeltas[ps.id] ?? 0)) <= ps.lowStockThreshold ? 'text-orange-600 font-semibold' : ''} ${productDeltas[ps.id] ? 'text-blue-600 dark:text-blue-400' : ''}`}
                              title="Click to edit quantity"
                            >
                              {ps.quantity + (productDeltas[ps.id] ?? 0)}
                            </button>
                          )}
                          <button
                            type="button"
                            className="h-6 w-6 rounded border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-40"
                            onClick={() => handleProductAdjust(ps.id, 'MANUAL_ADD')}
                            title="Add 1"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{ps.lowStockThreshold}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {ps.product?.unitPrice ? formatCurrency(parseFloat(ps.product.unitPrice)) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {activeTab === 'invoices' && (
        <Card padding={false} header={
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Invoices</h3>
            <Button size="sm" onClick={() => navigate(`/invoices/create?storeId=${id}`)}>
              New Invoice
            </Button>
          </div>
        }>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Number', 'Amount', 'Issue Date', 'Due Date', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(invoices?.data ?? []).map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-red-600">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(Number(inv.total))}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                      {getStatusLabel(inv.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'analytics' && (
        <Card header={<h3 className="font-semibold text-gray-900 dark:text-gray-100">Revenue Over Time</h3>}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
              <Bar dataKey="revenue" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card>
          <div className="text-center py-8 text-gray-400">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Activity log coming soon</p>
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Store" size="lg">
        <StoreForm
          defaultValues={store}
          onSubmit={(d) => updateMutation.mutate(d)}
          isLoading={updateMutation.isPending}
          onCancel={() => setEditOpen(false)}
          submitLabel="Save Changes"
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Store"
        description={`Are you sure you want to delete "${store.name}"? This cannot be undone.`}
        confirmText="Delete"
        danger
        isLoading={deleteMutation.isPending}
      />

      {/* Add Inventory Modal */}
      <Modal
        isOpen={addInventoryOpen}
        onClose={() => { setAddInventoryOpen(false); setAddForm(INITIAL_ADD_FORM); }}
        title="Add Inventory Item"
      >
        <form onSubmit={handleAddFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Box Type
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={addForm.boxTypeId}
              onChange={(e) => setAddForm((f) => ({ ...f, boxTypeId: e.target.value }))}
              required
            >
              <option value="">Select box type...</option>
              {(boxTypes ?? []).map((bt: { id: string; name: string }) => (
                <option key={bt.id} value={bt.id}>{bt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Box Size
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={addForm.boxSizeId}
              onChange={(e) => setAddForm((f) => ({ ...f, boxSizeId: e.target.value }))}
              required
            >
              <option value="">Select box size...</option>
              {(boxSizes ?? []).map((bs: { id: string; name: string }) => (
                <option key={bs.id} value={bs.id}>{bs.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quantity
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={addForm.quantity}
              onChange={(e) => setAddForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Price Per Unit ($)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={addForm.pricePerUnit}
              onChange={(e) => setAddForm((f) => ({ ...f, pricePerUnit: Number(e.target.value) }))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Low Stock Threshold
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={addForm.lowStockThreshold}
              onChange={(e) => setAddForm((f) => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setAddInventoryOpen(false); setAddForm(INITIAL_ADD_FORM); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createInventoryMutation.isPending}
            >
              Add Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Product Stock Modal */}
      <Modal
        isOpen={addProductStockOpen}
        onClose={() => { setAddProductStockOpen(false); setAddPsForm({ productId: '', quantity: 0, lowStockThreshold: 20 }); }}
        title="Add Product Stock"
      >
        <form onSubmit={handleAddProductStockSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={addPsForm.productId}
              onChange={(e) => setAddPsForm((f) => ({ ...f, productId: e.target.value }))}
              required
            >
              <option value="">Select product...</option>
              {(allProducts ?? [])
                .filter((p) => !(productStock ?? []).some((ps: { productId: string }) => ps.productId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.sku ? ` (${p.sku})` : ''}
                  </option>
                ))
              }
            </select>
            {allProducts && productStock && allProducts.length > 0 &&
              allProducts.filter((p) => !(productStock ?? []).some((ps: { productId: string }) => ps.productId === p.id)).length === 0 && (
              <p className="mt-1 text-xs text-gray-400">All products already have stock in this store.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={addPsForm.quantity}
                onChange={(e) => setAddPsForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Low Stock Threshold
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={addPsForm.lowStockThreshold}
                onChange={(e) => setAddPsForm((f) => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setAddProductStockOpen(false); setAddPsForm({ productId: '', quantity: 0, lowStockThreshold: 20 }); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={addProductStockMutation.isPending}
            >
              Add Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
