import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBoxTypes, createBoxType, updateBoxType, deactivateBoxType, reactivateBoxType, deleteBoxType } from '@/api/boxTypes';
import { usePermissions } from '@/hooks/usePermissions';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

export default function BoxTypes() {
  const qc = useQueryClient();
  const { canManageBoxTypes, isAdmin } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; description: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['box-types'],
    queryFn: () => getBoxTypes(),
  });

  const createMut = useMutation({
    mutationFn: createBoxType,
    onSuccess: () => { toast.success('Box type created'); qc.invalidateQueries({ queryKey: ['box-types'] }); setShowModal(false); setForm({ name: '', description: '' }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; description: string }) => updateBoxType(id, data),
    onSuccess: () => { toast.success('Box type updated'); qc.invalidateQueries({ queryKey: ['box-types'] }); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateBoxType(id),
    onSuccess: () => { toast.success('Box type deactivated'); qc.invalidateQueries({ queryKey: ['box-types'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => reactivateBoxType(id),
    onSuccess: () => { toast.success('Box type reactivated'); qc.invalidateQueries({ queryKey: ['box-types'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) => deleteBoxType(id, force),
    onSuccess: () => { toast.success('Box type deleted'); qc.invalidateQueries({ queryKey: ['box-types'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); setDeleteConfirm(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const boxTypes = data || [];

  return (
    <div>
      <PageHeader
        title="Box Types"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Box Types' }]}
        actions={canManageBoxTypes ? (
          <Button onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-2" /> Add Box Type</Button>
        ) : undefined}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : boxTypes.length === 0 ? (
          <EmptyState title="No box types" description="Add box types to start managing inventory" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Description</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
                {canManageBoxTypes && <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {boxTypes.map((bt: { id: string; name: string; description: string | null; isActive: boolean; _count?: { inventoryItems: number } }) => (
                <tr key={bt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{bt.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{bt.description || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge color={bt.isActive ? 'green' : 'gray'}>{bt.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  {canManageBoxTypes && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing({ id: bt.id, name: bt.name, description: bt.description || '' }); setForm({ name: bt.name, description: bt.description || '' }); setShowModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {bt.isActive ? (
                          <button onClick={() => deactivateMut.mutate(bt.id)}
                            className="p-1.5 text-gray-400 hover:text-yellow-600 rounded transition-colors" title="Deactivate">
                            <XCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => reactivateMut.mutate(bt.id)}
                            className="p-1.5 text-green-500 hover:text-green-700 rounded transition-colors" title="Reactivate">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteConfirm({ id: bt.id, name: bt.name })}
                            className="p-1.5 rounded transition-colors text-gray-400 hover:text-red-600 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal
          title={editing ? 'Edit Box Type' : 'Add Box Type'}
          onClose={() => { setShowModal(false); setEditing(null); setForm({ name: '', description: '' }); }}
        >
          <div className="space-y-4">
            <Input
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Standard"
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
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</Button>
              <Button
                loading={createMut.isPending || updateMut.isPending}
                onClick={() => {
                  if (editing) updateMut.mutate({ id: editing.id, ...form });
                  else createMut.mutate(form);
                }}
              >
                {editing ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Box Type"
          description={`Delete "${deleteConfirm.name}"? This will also remove all linked inventory items, transactions, and invoice line items. This cannot be undone.`}
          confirmText="Delete"
          onConfirm={() => deleteMut.mutate({ id: deleteConfirm.id, force: true })}
          onCancel={() => setDeleteConfirm(null)}
          danger
        />
      )}
    </div>
  );
}
