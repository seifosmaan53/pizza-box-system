import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getSettings, updateSettings } from '@/api/settings';
import { getUsers, createUser, updateUser, deactivateUser, reactivateUser } from '@/api/users';
import { getAuditLog } from '@/api/audit';
import { usePermissions } from '@/hooks/usePermissions';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import { formatDateTime } from '@/utils/formatters';

function CompanySettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [form, setForm] = useState({ companyName: '', companyAddress: '', companyEmail: '', companyPhone: '', defaultCurrency: 'USD', defaultTaxRate: 0, invoicePrefix: 'INV', lowStockGlobal: 20 });

  useEffect(() => {
    if (data) {
      setForm({
        companyName: data.companyName,
        companyAddress: data.companyAddress ?? '',
        companyEmail: data.companyEmail ?? '',
        companyPhone: data.companyPhone ?? '',
        defaultCurrency: data.defaultCurrency,
        defaultTaxRate: data.defaultTaxRate,
        invoicePrefix: data.invoicePrefix,
        lowStockGlobal: data.lowStockGlobal,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.companyName, data?.companyAddress, data?.companyEmail, data?.companyPhone, data?.defaultCurrency, data?.defaultTaxRate, data?.invoicePrefix, data?.lowStockGlobal]);

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => { toast.success('Settings saved'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  return (
    <div className="max-w-lg space-y-4">
      <Input label="Company Name" value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
      <Input label="Company Address" value={form.companyAddress} onChange={(e) => setForm((f) => ({ ...f, companyAddress: e.target.value }))} placeholder="Street address, City, State, ZIP" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Company Email" type="email" value={form.companyEmail} onChange={(e) => setForm((f) => ({ ...f, companyEmail: e.target.value }))} placeholder="billing@company.com" />
        <Input label="Company Phone" value={form.companyPhone} onChange={(e) => setForm((f) => ({ ...f, companyPhone: e.target.value }))} placeholder="(555) 000-0000" />
      </div>
      <Input label="Currency" value="USD — US Dollar" disabled helperText="All transactions are in US Dollars" />
      <Input label="Default Tax Rate (%)" type="number" step="0.01" min={0} max={100} value={form.defaultTaxRate}
        onChange={(e) => setForm((f) => ({ ...f, defaultTaxRate: parseFloat(e.target.value) }))} />
      <Input label="Invoice Prefix" value={form.invoicePrefix}
        onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))}
        helperText="e.g. INV → INV-2026-00001" />
      <Input label="Global Low Stock Threshold" type="number" min={0} max={10000} value={form.lowStockGlobal}
        onChange={(e) => setForm((f) => ({ ...f, lowStockGlobal: parseInt(e.target.value, 10) }))} />
      <Button loading={mutation.isPending} onClick={() => mutation.mutate(form)}>Save Settings</Button>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', role: 'VIEWER', password: '' });

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() });

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: () => { toast.success('User created'); qc.invalidateQueries({ queryKey: ['users'] }); setShowModal(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; firstName: string; lastName: string; role: string }) => updateUser(id, data),
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries({ queryKey: ['users'] }); setShowModal(false); setEditingUser(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateUser(id),
    onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => reactivateUser(id),
    onSuccess: () => { toast.success('User reactivated'); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const users = data?.data || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium text-gray-900 dark:text-white">Team Members</h3>
        <Button size="sm" onClick={() => { setEditingUser(null); setForm({ firstName: '', lastName: '', email: '', role: 'VIEWER', password: '' }); setShowModal(true); }}>
          Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Last Login</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map((u: { id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge color={u.role === 'ADMIN' ? 'red' : u.role === 'MANAGER' ? 'blue' : 'gray'}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditingUser({ id: u.id }); setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role, password: '' }); setShowModal(true); }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1">Edit</button>
                      {u.isActive ? (
                        <button onClick={() => deactivateMut.mutate(u.id)} className="text-xs text-orange-600 dark:text-orange-400 hover:underline px-2 py-1">Deactivate</button>
                      ) : (
                        <button onClick={() => reactivateMut.mutate(u.id)} className="text-xs text-green-600 dark:text-green-400 hover:underline px-2 py-1">Reactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editingUser ? 'Edit User' : 'Add User'} onClose={() => { setShowModal(false); setEditingUser(null); }}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name *" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
              <Input label="Last Name *" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
            {!editingUser && <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white">
                <option value="VIEWER">Viewer</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            {!editingUser && <Input label="Password *" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setShowModal(false); setEditingUser(null); }}>Cancel</Button>
              <Button loading={createMut.isPending || updateMut.isPending}
                onClick={() => editingUser ? updateMut.mutate({ id: editingUser.id, firstName: form.firstName, lastName: form.lastName, role: form.role }) : createMut.mutate(form)}>
                {editingUser ? 'Save' : 'Create User'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AuditLogTab() {
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => getAuditLog({ page, pageSize: 25 }),
  });

  const logs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div>
      {isLoading ? (
        <div className="space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Action</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.map((log: { id: string; createdAt: string; user?: { firstName: string; lastName: string }; action: string; entityType: string; entityLabel: string; changeDetails: Record<string, unknown> }) => (
                <>
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}</td>
                    <td className="px-4 py-3"><span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{log.action}</span></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{log.entityType}: {log.entityLabel}</td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={4} className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50">
                        <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-48">
                          {JSON.stringify(log.changeDetails, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {pagination && pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
              <span className="text-gray-500">Page {page} of {pagination.totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40">Previous</button>
                <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { isAdmin, canViewAuditLog } = usePermissions();

  const tabs = [
    { id: 'company', label: 'Company Settings', content: <CompanySettingsTab /> },
    ...(isAdmin ? [{ id: 'users', label: 'Users', content: <UsersTab /> }] : []),
    ...(canViewAuditLog ? [{ id: 'audit', label: 'Audit Log', content: <AuditLogTab /> }] : []),
  ];

  return (
    <div>
      <PageHeader title="Settings" breadcrumbs={[{ label: 'Settings' }]} />
      <Tabs tabs={tabs} />
    </div>
  );
}
