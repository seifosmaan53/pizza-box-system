import { lazy, Suspense, useEffect, useState, Component } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';
import { authApi } from '@/api/auth';
import AppLayout from '@/components/layout/AppLayout';

// Lazy-loaded pages
const Login = lazy(() => import('@/pages/Auth/Login'));
const ForgotPassword = lazy(() => import('@/pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/Auth/ResetPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const StoreList = lazy(() => import('@/pages/Stores/StoreList'));
const StoreDetail = lazy(() => import('@/pages/Stores/StoreDetail'));
const WarehouseView = lazy(() => import('@/pages/Inventory/WarehouseView'));
const StoreInventory = lazy(() => import('@/pages/Inventory/StoreInventory'));
const Products = lazy(() => import('@/pages/Inventory/Products'));
const BoxTypes = lazy(() => import('@/pages/Inventory/BoxTypes'));
const BoxSizes = lazy(() => import('@/pages/Inventory/BoxSizes'));
const InvoiceList = lazy(() => import('@/pages/Invoices/InvoiceList'));
const InvoiceCreate = lazy(() => import('@/pages/Invoices/InvoiceCreate'));
const InvoiceDetail = lazy(() => import('@/pages/Invoices/InvoiceDetail'));
const InvoiceEdit = lazy(() => import('@/pages/Invoices/InvoiceEdit'));
const SalesAnalytics = lazy(() => import('@/pages/Analytics/SalesAnalytics'));
const Settings = lazy(() => import('@/pages/Settings/Settings'));
const Profile = lazy(() => import('@/pages/Profile/Profile'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading…</span>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="text-red-500 text-4xl">⚠</div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Something went wrong</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md text-center">{this.state.error}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ROLE_LEVEL: Record<string, number> = { VIEWER: 0, MANAGER: 1, ADMIN: 2 };

function RequireRole({ minRole, children }: { minRole: 'MANAGER' | 'ADMIN'; children: React.ReactNode }) {
  const { user } = useAuthStore();
  const userLevel = ROLE_LEVEL[user?.role ?? 'VIEWER'] ?? 0;
  const requiredLevel = ROLE_LEVEL[minRole] ?? 0;

  if (userLevel < requiredLevel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-red-500 text-5xl">&#128274;</div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Access Denied</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md text-center">
          You don't have permission to view this page. Contact your administrator if you need access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function ProtectedRoute() {
  const { accessToken, setAccessToken } = useAuthStore();
  const location = useLocation();
  const [checking, setChecking] = useState(!accessToken);

  useEffect(() => {
    if (!accessToken) {
      authApi
        .refresh()
        .then((data) => {
          setAccessToken(data.accessToken);
        })
        .catch(() => {
          // refresh failed — will redirect after checking done
        })
        .finally(() => setChecking(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) return <PageLoader />;
  if (!accessToken) return <Navigate to="/login" state={{ from: location }} replace />;

  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}

export default function App() {
  const { darkMode } = useUIStore();

  // Sync dark mode class with localStorage on load
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Keep in sync when darkMode store changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stores" element={<StoreList />} />
            <Route path="/stores/:id" element={<StoreDetail />} />
            <Route path="/inventory/warehouse" element={<WarehouseView />} />
            <Route path="/inventory/stores" element={<StoreInventory />} />
            <Route path="/inventory/products" element={<Products />} />
            <Route path="/inventory/box-types" element={<RequireRole minRole="MANAGER"><BoxTypes /></RequireRole>} />
            <Route path="/inventory/box-sizes" element={<RequireRole minRole="MANAGER"><BoxSizes /></RequireRole>} />
            <Route path="/invoices" element={<InvoiceList />} />
            <Route path="/invoices/create" element={<RequireRole minRole="MANAGER"><InvoiceCreate /></RequireRole>} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/invoices/:id/edit" element={<RequireRole minRole="MANAGER"><InvoiceEdit /></RequireRole>} />
            <Route path="/analytics" element={<SalesAnalytics />} />
            <Route path="/settings" element={<RequireRole minRole="ADMIN"><Settings /></RequireRole>} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
