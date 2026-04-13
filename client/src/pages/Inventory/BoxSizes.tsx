import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, Edit2, XCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBoxSizes, createBoxSize, updateBoxSize, deactivateBoxSize, reactivateBoxSize, deleteBoxSize } from '@/api/boxSizes';
import { usePermissions } from '@/hooks/usePermissions';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

export default function BoxSizes() {
  const qc = useQueryClient();
  const { canManageBoxTypes, isAdmin } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: '', dimensions: '', sortOrder: 0 });
  const [dragging, setDragging] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['box-sizes'], queryFn: () => getBoxSizes() });

  const createMut = useMutation({
    mutationFn: createBoxSize,
    onSuccess: () => { toast.success('Box size created'); qc.invalidateQueries({ queryKey: ['box-sizes'] }); setShowModal(false); setForm({ name: '', dimensions: '', sortOrder: 0 }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; dimensions: string; sortOrder: number }) => updateBoxSize(id, data),
    onSuccess: () => { toast.success('Box size updated'); qc.invalidateQueries({ queryKey: ['box-sizes'] }); setEditing(null); setShowModal(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateBoxSize(id),
    onSuccess: () => { toast.success('Box size deactivated'); qc.invalidateQueries({ queryKey: ['box-sizes'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => reactivateBoxSize(id),
    onSuccess: () => { toast.success('Box size reactivated'); qc.invalidateQueries({ queryKey: ['box-sizes'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) => deleteBoxSize(id, force),
    onSuccess: () => { toast.success('Box size deleted'); qc.invalidateQueries({ queryKey: ['box-sizes'] }); qc.invalidateQueries({ queryKey: ['inventory'] }); setDeleteConfirm(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const boxSizes = data || [];

  const handleDragStart = (id: string) => setDragging(id);
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const from = boxSizes.find((s: { id: string }) => s.id === dragging);
    const to = boxSizes.find((s: { id: string }) => s.id === targetId);
    if (from && to) {
      Promise.all([
        updateMut.mutateAsync({ id: from.id, name: from.name, dimensions: from.dimensions || '', sortOrder: to.sortOrder }),
        updateMut.mutateAsync({ id: to.id, name: to.name, dimensions: to.dimensions || '', sortOrder: from.sortOrder }),
      ]).catch(() => qc.invalidateQueries({ queryKey: ['box-sizes'] }));
    }
    setDragging(null);
  };

  return (
    <div>
      <PageHeader
        title="Box Sizes"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Box Sizes' }]}
        actions={canManageBoxTypes ? (
          <Button onClick={() => { setEditing(null); setForm({ name: '', dimensions: '', sortOrder: boxSizes.length + 1 }); setShowModal(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Box Size
          </Button>
        ) : undefined}
      />

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Drag rows to reorder. Sort order determines display order in all dropdowns.</p>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : boxSizes.length === 0 ? (
          <EmptyState title="No box sizes" description="Add box sizes to manage inventory" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 w-10" />
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Dimensions</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Sort Order</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
                {canManageBoxTypes && <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {boxSizes.map((bs: { id: string; name: string; dimensions: string | null; sortOrder: number; isActive: boolean; _count?: { inventoryItems: number } }) => (
                <tr
                  key={bs.id}
                  draggable={canManageBoxTypes}
                  onDragStart={() => handleDragStart(bs.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(bs.id)}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${dragging === bs.id ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3 text-gray-300 cursor-grab">
                    {canManageBoxTypes && <GripVertical className="w-4 h-4" />}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{bs.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{bs.dimensions || '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{bs.sortOrder}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge color={bs.isActive ? 'green' : 'gray'}>{bs.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  {canManageBoxTypes && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditing({ id: bs.id }); setForm({ name: bs.name, dimensions: bs.dimensions || '', sortOrder: bs.sortOrder }); setShowModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {bs.isActive ? (
                          <button onClick={() => deactivateMut.mutate(bs.id)}
                            className="p-1.5 text-gray-400 hover:text-yellow-600 rounded transition-colors" title="Deactivate">
                            <XCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => reactivateMut.mutate(bs.id)}
                            className="p-1.5 text-green-500 hover:text-green-700 rounded transition-colors" title="Reactivate">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteConfirm({ id: bs.id, name: bs.name })}
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

      {showModal && (
        <Modal title={editing ? 'Edit Box Size' : 'Add Box Size'} onClose={() => { setShowModal(false); setEditing(null); }}>
          <div className="space-y-4">
            <Input label="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. 12-inch" />
            <Input label="Dimensions" value={form.dimensions} onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))} placeholder="e.g. 12 x 12 x 2 inches" />
            <Input label="Sort Order" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) }))} />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button loading={createMut.isPending || updateMut.isPending}
                onClick={() => editing ? updateMut.mutate({ id: editing.id, ...form }) : createMut.mutate(form)}>
                {editing ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmDialog title="Delete Box Size"
          description={`Delete "${deleteConfirm.name}"? This will also remove all linked inventory items, transactions, and invoice line items. This cannot be undone.`}
          confirmText="Delete" onConfirm={() => deleteMut.mutate({ id: deleteConfirm.id, force: true })} onCancel={() => setDeleteConfirm(null)} danger />
      )}
    </div>
  );
}
