import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Download,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { invoicesApi } from '@/api/invoices';
import { storesApi } from '@/api/stores';
import { usePermissions } from '@/hooks/usePermissions';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton from '@/components/ui/Skeleton';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { downloadCsv } from '@/utils/exportCsv';
import { STATUS_BADGE_COLORS, INVOICE_STATUSES } from '@/utils/constants';
import type { Invoice, InvoiceStatus } from '@/types';

const STATUS_COLORS = STATUS_BADGE_COLORS;
const STATUSES: InvoiceStatus[] = [...INVOICE_STATUSES];

type ConfirmAction = {
  action: 'send' | 'pay' | 'cancel' | 'delete';
  ids: string[];
  label: string;
};

function exportCSV(invoices: Invoice[]) {
  const headers = ['Invoice #', 'Store', 'Issue Date', 'Due Date', 'Items', 'Subtotal', 'Tax', 'Total', 'Status', 'Created By'];
  const rows = invoices.map((inv) => [
    inv.invoiceNumber,
    inv.store?.name ?? '',
    formatDate(inv.issueDate),
    formatDate(inv.dueDate),
    String(inv._count?.lineItems ?? inv.lineItems?.length ?? 0),
    String(Number(inv.subtotal).toFixed(2)),
    String(Number(inv.taxAmount).toFixed(2)),
    String(Number(inv.total).toFixed(2)),
    inv.status,
    inv.createdBy ? `${inv.createdBy.firstName} ${inv.createdBy.lastName}` : '',
  ]);
  downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export default function InvoiceList() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perms = usePermissions();

  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<InvoiceStatus[]>([]);
  const [storeId, setStoreId] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [paidDate, setPaidDate] = useState('');

  const queryParams = {
    search,
    status: overdueOnly ? (['OVERDUE'] as InvoiceStatus[]) : statusFilters.length ? statusFilters : undefined,
    storeId: storeId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    limit: 25,
  };

  const invoicesQuery = useQuery({
    queryKey: ['invoices', queryParams],
    queryFn: () => invoicesApi.getInvoices(queryParams),
    placeholderData: (prev) => prev,
  });

  const storesQuery = useQuery({
    queryKey: ['stores', { isActive: true }],
    queryFn: () => storesApi.getStores({ isActive: true, limit: 200 }),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => invoicesApi.sendInvoice(id),
    onSuccess: () => {
      toast.success('Invoice sent');
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payMut = useMutation({
    mutationFn: (id: string) => invoicesApi.payInvoice(id, paidDate || undefined),
    onSuccess: () => {
      toast.success('Invoice marked as paid');
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => invoicesApi.cancelInvoice(id),
    onSuccess: () => {
      toast.success('Invoice cancelled');
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => invoicesApi.deleteInvoice(id),
    onSuccess: () => {
      toast.success('Invoice deleted');
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invoices: Invoice[] = invoicesQuery.data?.data ?? [];
  const pagination = invoicesQuery.data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? invoices.length;

  const filteredStores = storesQuery.data?.data?.filter((s) =>
    s.name.toLowerCase().includes(storeSearch.toLowerCase())
  ) ?? [];

  const toggleStatus = (s: InvoiceStatus) => {
    setStatusFilters((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
    setPage(1);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const allSelected = invoices.length > 0 && selected.length === invoices.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(invoices.map((i) => i.id));
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { action, ids } = confirm;
    setBulkLoading(true);
    setBulkProgress({ done: 0, total: ids.length });
    let failed = 0;
    try {
      for (let i = 0; i < ids.length; i++) {
        try {
          if (action === 'pay') await payMut.mutateAsync(ids[i], { onSuccess: undefined } as never);
          else if (action === 'cancel') await cancelMut.mutateAsync(ids[i]);
          else if (action === 'delete') await deleteMut.mutateAsync(ids[i]);
          else if (action === 'send') await sendMut.mutateAsync(ids[i]);
        } catch {
          failed++;
        }
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      if (failed > 0) toast.error(`${failed} of ${ids.length} operations failed`);
      else if (ids.length > 1) toast.success(`${ids.length} invoices updated`);
      qc.invalidateQueries({ queryKey: ['invoices'] });
    } finally {
      setBulkLoading(false);
      setSelected([]);
      setConfirm(null);
      setPaidDate('');
    }
  };

  const handleDownloadPDF = async (id: string, invoiceNumber: string) => {
    try {
      const blob = await invoicesApi.downloadPDF(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilters([]);
    setStoreId('');
    setStoreSearch('');
    setStartDate('');
    setEndDate('');
    setOverdueOnly(false);
    setPage(1);
  };

  const hasFilters =
    search || statusFilters.length || storeId || startDate || endDate || overdueOnly;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        breadcrumbs={[{ label: 'Invoices' }]}
        actions={
          <div className="flex items-center gap-2">
            {perms.canExportData && (
              <Button
                variant="outline"
                onClick={() => exportCSV(invoices)}
                disabled={invoices.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            )}
            {perms.canCreateInvoice && (
              <Button onClick={() => navigate('/invoices/create')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            )}
          </div>
        }
      />

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-start">
          {/* Text search */}
          <input
            type="text"
            placeholder="Search invoice # or store... (press / to focus)"
            aria-label="Search invoices"
            data-search-input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />

          {/* Store searchable dropdown */}
          <div className="relative min-w-48">
            <input
              type="text"
              placeholder="Filter by store..."
              value={storeId ? (storesQuery.data?.data?.find((s) => s.id === storeId)?.name ?? storeSearch) : storeSearch}
              onChange={(e) => {
                setStoreSearch(e.target.value);
                if (!e.target.value) setStoreId('');
                setPage(1);
              }}
              onFocus={() => setStoreSearch('')}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {storeSearch && !storeId && filteredStores.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => { setStoreId(''); setStoreSearch(''); }}
                >
                  All Stores
                </button>
                {filteredStores.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    onClick={() => {
                      setStoreId(s.id);
                      setStoreSearch('');
                      setPage(1);
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Overdue toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }}
              className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <AlertCircle className="w-4 h-4 text-orange-500" />
            Overdue only
          </label>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Status checkbox multi-select */}
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={statusFilters.includes(s)}
                onChange={() => toggleStatus(s)}
                className="rounded border-gray-300 focus:ring-orange-500"
              />
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  s === 'DRAFT'
                    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    : s === 'SENT'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : s === 'PAID'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : s === 'OVERDUE'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {s}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-blue-700 dark:text-blue-300 font-medium">
            {selected.length} selected
          </span>
          <button
            onClick={() =>
              setConfirm({
                action: 'pay',
                ids: selected,
                label: `Mark ${selected.length} invoice(s) as paid?`,
              })
            }
            className="text-green-700 dark:text-green-400 hover:underline font-medium"
          >
            Mark Paid
          </button>
          <button
            onClick={() =>
              setConfirm({
                action: 'cancel',
                ids: selected,
                label: `Cancel ${selected.length} invoice(s)? This cannot be undone.`,
              })
            }
            className="text-red-700 dark:text-red-400 hover:underline font-medium"
          >
            Cancel
          </button>
          {perms.isAdmin && (
            <button
              onClick={() =>
                setConfirm({
                  action: 'delete',
                  ids: selected,
                  label: `Permanently delete ${selected.length} invoice(s)? Inventory will be restored for sent/paid invoices.`,
                })
              }
              className="text-red-700 dark:text-red-400 hover:underline font-medium"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => setSelected([])}
            className="ml-auto text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {invoicesQuery.isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="w-14 h-14 mb-4 opacity-40" />
            <p className="font-medium text-gray-600 dark:text-gray-300 text-lg">No invoices found</p>
            <p className="text-sm mt-1 text-gray-400 dark:text-gray-500">
              {hasFilters ? 'Try adjusting your filters' : 'Create your first invoice to get started'}
            </p>
            {perms.canCreateInvoice && !hasFilters && (
              <Button className="mt-4" onClick={() => navigate('/invoices/create')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <p className="sr-only" role="status" aria-live="polite">
              Showing {invoices.length} of {total} invoices
            </p>
            <table className="w-full text-sm" aria-label="Invoices">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all invoices"
                      className="rounded border-gray-300 focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Invoice #
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Store
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Issue Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                    Items
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                    Subtotal
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                    Tax
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Created By
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        aria-label={`Select invoice ${inv.invoiceNumber}`}
                        className="rounded border-gray-300 focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-mono text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {inv.store?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(inv.issueDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(inv.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {inv._count?.lineItems ?? inv.lineItems?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {formatCurrency(Number(inv.subtotal), inv.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {formatCurrency(Number(inv.taxAmount), inv.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(Number(inv.total), inv.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          inv.status === 'DRAFT'
                            ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            : inv.status === 'SENT'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : inv.status === 'PAID'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : inv.status === 'OVERDUE'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-sm">
                      {inv.createdBy
                        ? `${inv.createdBy.firstName} ${inv.createdBy.lastName}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* View */}
                        <Link to={`/invoices/${inv.id}`}>
                          <button
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>

                        {/* Edit (DRAFT only) */}
                        {perms.canEditInvoice(inv.status) && (
                          <Link to={`/invoices/${inv.id}/edit`}>
                            <button
                              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </Link>
                        )}

                        {/* Send (DRAFT only) */}
                        {perms.canSendInvoice(inv.status) && inv.status === 'DRAFT' && (
                          <button
                            onClick={() =>
                              setConfirm({
                                action: 'send',
                                ids: [inv.id],
                                label: `Send invoice ${inv.invoiceNumber}? This will deduct inventory.`,
                              })
                            }
                            className="p-1.5 text-blue-400 hover:text-blue-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Send Invoice"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}

                        {/* Mark Paid (SENT / OVERDUE) */}
                        {perms.canMarkPaid(inv.status) && (
                          <button
                            onClick={() =>
                              setConfirm({
                                action: 'pay',
                                ids: [inv.id],
                                label: `Mark invoice ${inv.invoiceNumber} as paid?`,
                              })
                            }
                            className="p-1.5 text-green-400 hover:text-green-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Mark Paid"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Cancel (DRAFT / SENT) */}
                        {perms.canCancelInvoice(inv.status) && (
                          <button
                            onClick={() =>
                              setConfirm({
                                action: 'cancel',
                                ids: [inv.id],
                                label: `Cancel invoice ${inv.invoiceNumber}?${inv.status === 'SENT' ? ' Inventory will be restored.' : ''}`,
                              })
                            }
                            className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Cancel"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Download PDF */}
                        <button
                          onClick={() => handleDownloadPDF(inv.id, inv.invoiceNumber)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {/* Delete (DRAFT only, ADMIN) */}
                        {perms.canDeleteInvoice(inv.status) && (
                          <button
                            onClick={() =>
                              setConfirm({
                                action: 'delete',
                                ids: [inv.id],
                                label: `Permanently delete invoice ${inv.invoiceNumber}?`,
                              })
                            }
                            className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = page <= 3 ? i + 1 : page + i - 2;
                if (pg < 1 || pg > totalPages) return null;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`px-3 py-1 rounded border text-sm ${
                      pg === page
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      {confirm && (
        <ConfirmDialog
          title="Confirm Action"
          description={bulkLoading && bulkProgress.total > 1
            ? `Processing ${bulkProgress.done} of ${bulkProgress.total}…`
            : confirm.label}
          confirmText={
            confirm.action === 'delete'
              ? 'Delete'
              : confirm.action === 'cancel'
              ? 'Cancel Invoice'
              : confirm.action === 'pay'
              ? 'Mark Paid'
              : 'Send'
          }
          onConfirm={handleConfirm}
          onCancel={() => { setConfirm(null); setPaidDate(''); }}
          danger={confirm.action === 'cancel' || confirm.action === 'delete'}
          isLoading={bulkLoading}
        >
          {confirm.action === 'pay' && !bulkLoading && (
            <div className="mt-3 w-full text-left">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                <Calendar className="h-3.5 w-3.5" />
                Payment date (optional)
              </label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-xs text-gray-400 mt-1">Leave empty to use today's date</p>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
