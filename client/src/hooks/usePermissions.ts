import { useAuthStore } from '@/store/auth';
import type { InvoiceStatus } from '@/types';

export function usePermissions() {
  const { user } = useAuthStore();
  const role = user?.role ?? '';

  const isAdmin = role === 'ADMIN';
  const isManager = role === 'MANAGER' || isAdmin;
  const isViewer = role === 'VIEWER' || isManager;

  return {
    // Role checks
    isAdmin,
    isManager,
    isViewer,
    role,

    // Store permissions
    canViewStores: isViewer,
    canCreateStore: isManager,
    canEditStore: isManager,
    canDeleteStore: isAdmin,
    canDeactivateStore: isAdmin,

    // Box type / size permissions
    canViewBoxTypes: isViewer,
    canManageBoxTypes: isManager,
    canDeleteBoxTypes: isAdmin,

    canViewBoxSizes: isViewer,
    canManageBoxSizes: isManager,
    canDeleteBoxSizes: isAdmin,

    // Inventory permissions
    canViewInventory: isViewer,
    canCreateInventoryItem: isManager,
    canEditInventoryItem: isManager,
    canAdjustInventory: isManager,
    canDeleteInventoryItem: isAdmin,
    canBulkImport: isManager,

    // Invoice permissions
    canViewInvoices: isViewer,
    canCreateInvoice: isManager,
    canEditInvoice: (status: InvoiceStatus) => isManager && status === 'DRAFT',
    canSendInvoice: (status: InvoiceStatus) =>
      isManager && (status === 'DRAFT' || status === 'SENT'),
    canMarkPaid: (status: InvoiceStatus) =>
      isManager && (status === 'SENT' || status === 'OVERDUE'),
    canCancelInvoice: (status: InvoiceStatus) =>
      isAdmin && (status === 'DRAFT' || status === 'SENT'),
    canDeleteInvoice: (_status: InvoiceStatus) => isAdmin,

    // Analytics permissions
    canViewAnalytics: isViewer,
    canExportData: isManager,

    // Settings permissions
    canViewSettings: isAdmin,
    canEditSettings: isAdmin,
    canManageUsers: isAdmin,
    canViewAuditLog: isAdmin,
  };
}
