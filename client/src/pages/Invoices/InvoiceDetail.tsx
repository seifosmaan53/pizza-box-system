import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Download,
  Trash2,
  ArrowLeft,
  Clock,
  User,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { invoicesApi } from '@/api/invoices';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/auth';
import Skeleton from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime } from '@/utils/formatters';
import type { Invoice } from '@/types';

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const cls =
    status === 'DRAFT'
      ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
      : status === 'SENT'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
      : status === 'PAID'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : status === 'OVERDUE'
      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function InvoiceDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-24 w-64 ml-auto" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perms = usePermissions();
  const { user } = useAuthStore();

  const [confirm, setConfirm] = useState<{
    action: 'send' | 'pay' | 'cancel' | 'delete';
    label: string;
  } | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.getInvoice(id!),
    enabled: !!id,
  });

  const invoice: Invoice | undefined = query.data;

  // Sync internal notes when invoice data loads
  const prevInvoiceId = useRef<string | null>(null);
  if (invoice && prevInvoiceId.current !== invoice.id) {
    prevInvoiceId.current = invoice.id;
    setInternalNotes(invoice.internalNotes ?? '');
  }

  const sendMut = useMutation({
    mutationFn: () => invoicesApi.sendInvoice(id!),
    onSuccess: () => { toast.success('Invoice sent'); qc.invalidateQueries({ queryKey: ['invoice', id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const payMut = useMutation({
    mutationFn: () => invoicesApi.payInvoice(id!),
    onSuccess: () => { toast.success('Marked as paid'); qc.invalidateQueries({ queryKey: ['invoice', id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => invoicesApi.cancelInvoice(id!),
    onSuccess: () => { toast.success('Invoice cancelled'); qc.invalidateQueries({ queryKey: ['invoice', id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => invoicesApi.deleteInvoice(id!),
    onSuccess: () => { toast.success('Invoice deleted'); navigate('/invoices'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateNotesMut = useMutation({
    mutationFn: (notes: string) => invoicesApi.updateInvoice(id!, { internalNotes: notes }),
    onSuccess: () => {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ['invoice', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasUnsavedNotes = invoice ? internalNotes !== (invoice.internalNotes ?? '') : false;

  const debounceSaveNotes = (value: string) => {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      if (invoice && value !== (invoice.internalNotes ?? '')) {
        updateNotesMut.mutate(value);
      }
    }, 1500);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInternalNotes(e.target.value);
    debounceSaveNotes(e.target.value);
  };

  const handleNotesBlur = () => {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    if (invoice && internalNotes !== (invoice.internalNotes ?? '')) {
      updateNotesMut.mutate(internalNotes);
    }
  };

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.action === 'send') sendMut.mutate();
    else if (confirm.action === 'pay') payMut.mutate();
    else if (confirm.action === 'cancel') cancelMut.mutate();
    else if (confirm.action === 'delete') deleteMut.mutate();
    setConfirm(null);
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    try {
      const blob = await invoicesApi.downloadPDF(id!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  if (query.isLoading) return <InvoiceDetailSkeleton />;

  if (query.isError || !invoice) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500 dark:text-gray-400">Invoice not found.</p>
        <Link to="/invoices" className="text-orange-500 hover:underline text-sm mt-2 inline-block">
          Back to Invoices
        </Link>
      </div>
    );
  }

  const store = invoice.store;
  const currency = invoice.currency;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back + actions bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/invoices"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>

        <div className="flex items-center gap-2">
          {/* DRAFT actions */}
          {invoice.status === 'DRAFT' && (
            <>
              {perms.canEditInvoice(invoice.status) && (
                <Link to={`/invoices/${id}/edit`}>
                  <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                </Link>
              )}
              {perms.canSendInvoice(invoice.status) && (
                <button
                  onClick={() => setConfirm({ action: 'send', label: 'Send this invoice? Inventory will be deducted.' })}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  <Send className="w-4 h-4" />
                  Send Invoice
                </button>
              )}
              {perms.canDeleteInvoice(invoice.status) && (
                <button
                  onClick={() => setConfirm({ action: 'delete', label: 'Permanently delete this invoice?' })}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </>
          )}

          {/* SENT actions */}
          {invoice.status === 'SENT' && (
            <>
              {perms.canMarkPaid(invoice.status) && (
                <button
                  onClick={() => setConfirm({ action: 'pay', label: 'Mark this invoice as paid?' })}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Paid
                </button>
              )}
              {perms.canCancelInvoice(invoice.status) && (
                <button
                  onClick={() => setConfirm({ action: 'cancel', label: 'Cancel this invoice? Inventory will be restored.' })}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              )}
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </>
          )}

          {/* PAID actions */}
          {invoice.status === 'PAID' && (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400 italic">Read only</span>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </>
          )}

          {/* OVERDUE actions */}
          {invoice.status === 'OVERDUE' && (
            <>
              {perms.canMarkPaid(invoice.status) && (
                <button
                  onClick={() => setConfirm({ action: 'pay', label: 'Mark this overdue invoice as paid?' })}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark Paid
                </button>
              )}
              {perms.canCancelInvoice(invoice.status) && (
                <button
                  onClick={() => setConfirm({ action: 'cancel', label: 'Cancel this invoice?' })}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              )}
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </>
          )}

          {/* CANCELLED actions */}
          {invoice.status === 'CANCELLED' && (
            <>
              {perms.canDeleteInvoice(invoice.status) && (
                <button
                  onClick={() => setConfirm({ action: 'delete', label: 'Permanently delete this invoice?' })}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Invoice document */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 print:p-0 print:border-0">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">INVOICE</h1>
            <p className="font-mono text-xl text-orange-500 mt-1 flex items-center gap-2">
              {invoice.invoiceNumber}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(invoice.invoiceNumber);
                  toast.success('Invoice number copied');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Copy invoice number"
                title="Copy invoice number"
              >
                <Copy className="h-4 w-4" />
              </button>
            </p>
          </div>
          <div className="text-right">
            <StatusBadge status={invoice.status} />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Issued: {formatDate(invoice.issueDate)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Due: {formatDate(invoice.dueDate)}
            </p>
            {invoice.paidAt && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Paid: {formatDate(invoice.paidAt)}
              </p>
            )}
          </div>
        </div>

        {/* Bill to */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Bill To
            </p>
            <p className="font-semibold text-gray-900 dark:text-white text-lg">{store?.name}</p>
            {store?.contactName && (
              <p className="text-gray-600 dark:text-gray-400">{store.contactName}</p>
            )}
            {store?.address && (
              <p className="text-gray-600 dark:text-gray-400 text-sm">{store.address}</p>
            )}
            {store?.city && (
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {[store.city, store.state, store.zipCode].filter(Boolean).join(', ')}
              </p>
            )}
            {store?.email && (
              <p className="text-gray-500 dark:text-gray-500 text-sm">{store.email}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Payment Details
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Currency: <span className="font-medium text-gray-900 dark:text-white">{currency}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Tax Rate:{' '}
              <span className="font-medium text-gray-900 dark:text-white">{invoice.taxRate}%</span>
            </p>
          </div>
        </div>

        {/* Line items table */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                  Description
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                  Qty
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {invoice.lineItems?.map((li, i) => (
                <tr key={li.id ?? i}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{li.description}</p>
                    {(li.boxTypeSnapshot || li.inventoryItem?.boxType) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {li.boxTypeSnapshot || li.inventoryItem?.boxType?.name}
                        {(li.boxSizeSnapshot || li.inventoryItem?.boxSize) && ` — ${li.boxSizeSnapshot || li.inventoryItem?.boxSize?.name}`}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    {li.quantityOrdered}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    {formatCurrency(Number(li.unitPrice), currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(Number(li.lineTotal), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Subtotal</span>
              <span>{formatCurrency(Number(invoice.subtotal), currency)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Tax ({invoice.taxRate}%)</span>
              <span>{formatCurrency(Number(invoice.taxAmount), currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
              <span>Total</span>
              <span>{formatCurrency(Number(invoice.total), currency)}</span>
            </div>
          </div>
        </div>

        {/* Customer notes */}
        {invoice.notes && (
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
            <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Internal notes (ADMIN / MANAGER only) */}
      {perms.isManager && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Internal Notes</h3>
            <span className="text-xs flex items-center gap-1">
              {updateNotesMut.isPending && (
                <span className="text-gray-400">Saving…</span>
              )}
              {notesSaved && (
                <span className="text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Saved
                </span>
              )}
              {!updateNotesMut.isPending && !notesSaved && hasUnsavedNotes && (
                <span className="text-orange-400">Unsaved changes</span>
              )}
            </span>
          </div>
          <textarea
            value={internalNotes}
            onChange={handleNotesChange}
            onBlur={handleNotesBlur}
            rows={3}
            placeholder="Add internal notes here… (auto-saved as you type)"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">Not visible on the invoice. Auto-saved after 1.5s or when you click away.</p>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Timeline</h3>
        <div className="space-y-3">
          {/* Created */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Created</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatDateTime(invoice.createdAt)}
                {invoice.createdBy && (
                  <> by {invoice.createdBy.firstName} {invoice.createdBy.lastName}</>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(invoice.createdAt)}</p>
            </div>
          </div>

          {/* Sent */}
          {invoice.sentAt && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Send className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Sent</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(invoice.sentAt)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(invoice.sentAt)}</p>
              </div>
            </div>
          )}

          {/* Paid */}
          {invoice.paidAt && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Paid</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(invoice.paidAt)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(invoice.paidAt)}</p>
              </div>
            </div>
          )}

          {/* Cancelled */}
          {invoice.status === 'CANCELLED' && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Cancelled</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(invoice.updatedAt)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          title="Confirm Action"
          description={confirm.label}
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
          onCancel={() => setConfirm(null)}
          danger={confirm.action === 'cancel' || confirm.action === 'delete'}
        />
      )}
    </div>
  );
}
