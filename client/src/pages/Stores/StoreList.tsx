import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, Store as StoreIcon, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { storesApi } from '@/api/stores';
import { queryClient } from '@/lib/queryClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StoreForm, type StoreFormData } from './StoreForm';
import { QUERY_KEYS, US_STATES, DEFAULT_PAGE_SIZE } from '@/utils/constants';
import { usePermissions } from '@/hooks/usePermissions';
import type { Store } from '@/types';

export default function StoreList() {
  const navigate = useNavigate();
  const perms = usePermissions();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editStore, setEditStore] = useState<Store | null>(null);
  const [deleteStore, setDeleteStore] = useState<Store | null>(null);
  const [deactivateStore, setDeactivateStore] = useState<Store | null>(null);

  const params = {
    page,
    limit: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
    state: stateFilter || undefined,
    sortBy,
    sortOrder,
  };

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.stores, params],
    queryFn: () => storesApi.getStores(params),
  });

  const createMutation = useMutation({
    mutationFn: storesApi.createStore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.stores] });
      setCreateOpen(false);
      toast.success('Store created successfully');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed to create store'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StoreFormData }) =>
      storesApi.updateStore(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.stores] });
      setEditStore(null);
      toast.success('Store updated');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed to update store'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storesApi.deleteStore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.stores] });
      setDeleteStore(null);
      toast.success('Store deleted');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed to delete store'),
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? storesApi.deactivateStore(id) : storesApi.reactivateStore(id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.stores] });
      setDeactivateStore(null);
      toast.success(vars.active ? 'Store deactivated' : 'Store reactivated');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed'),
  });

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleExportCSV = async () => {
    try {
      const blob = await storesApi.exportCSV(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stores.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row: Store) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{row.name}</p>
          {row.city && <p className="text-xs text-gray-500 dark:text-gray-400">{row.city}{row.state ? `, ${row.state}` : ''}</p>}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (row: Store) => (
        <span className="text-gray-600 dark:text-gray-400">
          {[row.city, US_STATES.find((s) => s.code === row.state)?.name, row.zipCode].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'contactName',
      header: 'Contact',
      render: (row: Store) => (
        <div>
          <p className="text-sm">{row.contactName || '—'}</p>
          {row.email && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{row.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row: Store) => (
        <Badge color={row.isActive ? 'green' : 'gray'} dot>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (row: Store) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setEditStore(row); }}
            className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Edit
          </button>
          {perms.canDeactivateStore && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeactivateStore(row); }}
              className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {row.isActive ? 'Deactivate' : 'Activate'}
            </button>
          )}
          {perms.canDeleteStore && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteStore(row); }}
              className="px-2.5 py-1 text-xs rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Stores"
        breadcrumbs={[{ label: 'Stores' }]}
        description={`${data?.data?.length ?? 0} stores total`}
        actions={
          <>
            <Button variant="secondary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={handleExportCSV}>
              Export CSV
            </Button>
            {perms.canCreateStore && (
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
                Add Store
              </Button>
            )}
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search stores… (press / to focus)"
          leftIcon={<Search className="h-4 w-4" />}
          data-search-input
          aria-label="Search stores"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          containerClassName="w-60"
        />
        <Select
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          placeholder="All Status"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          clearable
          containerClassName="w-36"
        />
        <Select
          options={US_STATES.map((s) => ({ value: s.code, label: s.name }))}
          placeholder="All States"
          value={stateFilter}
          onChange={(v) => { setStateFilter(v); setPage(1); }}
          clearable
          containerClassName="w-44"
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={data?.data ?? []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          emptyMessage="No stores found"
          emptyIcon={<StoreIcon className="h-8 w-8" />}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={(r) => navigate(`/stores/${r.id}`)}
          page={page}
          totalPages={undefined}
          onPageChange={setPage}
          total={data?.data?.length}
          pageSize={DEFAULT_PAGE_SIZE}
        />
      </div>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Store" size="lg">
        <StoreForm
          onSubmit={(d) => createMutation.mutate(d)}
          isLoading={createMutation.isPending}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create Store"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editStore} onClose={() => setEditStore(null)} title="Edit Store" size="lg">
        {editStore && (
          <StoreForm
            defaultValues={editStore}
            onSubmit={(d) => updateMutation.mutate({ id: editStore.id, data: d })}
            isLoading={updateMutation.isPending}
            onCancel={() => setEditStore(null)}
            submitLabel="Save Changes"
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteStore}
        onClose={() => setDeleteStore(null)}
        onConfirm={() => deleteStore && deleteMutation.mutate(deleteStore.id)}
        title="Delete Store"
        description={`Are you sure you want to delete "${deleteStore?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        danger
        isLoading={deleteMutation.isPending}
      />

      {/* Deactivate Confirm */}
      <ConfirmDialog
        isOpen={!!deactivateStore}
        onClose={() => setDeactivateStore(null)}
        onConfirm={() =>
          deactivateStore &&
          deactivateMutation.mutate({ id: deactivateStore.id, active: deactivateStore.isActive })
        }
        title={deactivateStore?.isActive ? 'Deactivate Store' : 'Reactivate Store'}
        description={
          deactivateStore?.isActive
            ? `Deactivating "${deactivateStore?.name}" will hide it from active lists.`
            : `Reactivate "${deactivateStore?.name}"?`
        }
        confirmText={deactivateStore?.isActive ? 'Deactivate' : 'Reactivate'}
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
}
