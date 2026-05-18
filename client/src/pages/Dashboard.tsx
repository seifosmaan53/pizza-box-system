import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Package,
  Store,
  FileText,
  AlertTriangle,
  TrendingDown,
  ArrowRight,
  CheckCircle,
  DollarSign,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { analyticsApi } from '@/api/analytics';
import { inventoryApi } from '@/api/inventory';
import { invoicesApi } from '@/api/invoices';
import { storesApi } from '@/api/stores';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { OnboardingChecklist } from '@/components/ui/OnboardingChecklist';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { LowStockItem } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { QUERY_KEYS, STATUS_HEX_COLORS } from '@/utils/constants';

export default function Dashboard() {
  const { data: invoiceSummary, isLoading: summaryLoading } = useQuery({
    queryKey: [QUERY_KEYS.invoiceSummary],
    queryFn: () => analyticsApi.getInvoiceSummary(),
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: inventorySnapshot, isLoading: snapshotLoading } = useQuery({
    queryKey: [QUERY_KEYS.inventorySnapshot],
    queryFn: analyticsApi.getInventorySnapshot,
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: topStores, isLoading: topStoresLoading } = useQuery({
    queryKey: [QUERY_KEYS.salesByStore, 'top'],
    queryFn: () => analyticsApi.getTopStores({ limit: 5 }),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: storesData, isLoading: storesLoading } = useQuery({
    queryKey: [QUERY_KEYS.stores],
    queryFn: () => storesApi.getStores({ limit: 100 }),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: lowStock, isLoading: lowStockLoading } = useQuery({
    queryKey: [QUERY_KEYS.lowStock],
    queryFn: inventoryApi.getLowStockItems,
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: recentInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: [QUERY_KEYS.invoices, 'recent'],
    queryFn: () => invoicesApi.getInvoices({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
    refetchInterval: 2 * 60 * 1000,
  });

  const activeStores = storesData?.data?.filter((s) => s.isActive).length ?? 0;

  // Pie chart data
  const pieData = invoiceSummary
    ? [
        { name: 'Draft', value: invoiceSummary.totalDraft, status: 'DRAFT' },
        { name: 'Sent', value: invoiceSummary.totalSent, status: 'SENT' },
        { name: 'Paid', value: invoiceSummary.totalPaid, status: 'PAID' },
        { name: 'Overdue', value: invoiceSummary.totalOverdue, status: 'OVERDUE' },
        { name: 'Cancelled', value: invoiceSummary.totalCancelled, status: 'CANCELLED' },
      ].filter((d) => d.value > 0)
    : [];

  const storeCount = storesData?.data?.length ?? 0;
  const inventoryCount = inventorySnapshot?.totalQuantity ?? 0;
  const invoiceCount = invoiceSummary ? (invoiceSummary.totalDraft + invoiceSummary.totalSent + invoiceSummary.totalPaid + invoiceSummary.totalOverdue + invoiceSummary.totalCancelled) : 0;

  return (
    <div className="space-y-6">
      {/* Onboarding — auto-hides when all steps complete */}
      {!summaryLoading && !storesLoading && (
        <OnboardingChecklist storeCount={storeCount} inventoryCount={inventoryCount} invoiceCount={invoiceCount} />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Inventory"
          value={inventorySnapshot?.totalQuantity ?? 0}
          icon={<Package className="h-5 w-5" />}
          color="blue"
          isLoading={snapshotLoading}
          animateNumber
        />
        <StatCard
          label="Active Stores"
          value={activeStores}
          icon={<Store className="h-5 w-5" />}
          color="green"
          isLoading={storesLoading}
          animateNumber
        />
        <StatCard
          label="Outstanding Value"
          value={formatCurrency(invoiceSummary?.totalOutstanding ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
          color="purple"
          isLoading={summaryLoading}
          animateNumber={false}
        />
        <StatCard
          label="Overdue Invoices"
          value={invoiceSummary?.totalOverdue ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          color={(invoiceSummary?.totalOverdue ?? 0) > 0 ? 'orange' : 'gray'}
          isLoading={summaryLoading}
          animateNumber
        />
        <StatCard
          label="Low Stock Items"
          value={lowStock?.length ?? 0}
          icon={<TrendingDown className="h-5 w-5" />}
          color={(lowStock?.length ?? 0) > 0 ? 'yellow' : 'gray'}
          isLoading={lowStockLoading}
          animateNumber
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Stores Bar Chart */}
        <Card className="lg:col-span-2" header={
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Top 5 Stores by Revenue</h2>
            <Link to="/analytics" className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        }>
          {topStoresLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topStores ?? []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <YAxis
                  type="category"
                  dataKey="storeName"
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  width={80}
                />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Invoice Status Donut */}
        <Card header={
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Invoice Status</h2>
        }>
          {summaryLoading ? (
            <div className="flex items-center justify-center h-52">
              <Skeleton className="h-40 w-40 rounded-full" />
            </div>
          ) : pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3 text-center">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
                <FileText className="h-7 w-7 text-gray-400 dark:text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No invoices yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Create one to see the breakdown</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_HEX_COLORS[entry.status as keyof typeof STATUS_HEX_COLORS] || '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend
                  formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Invoices */}
        <div className="lg:col-span-2">
          <Card
            padding={false}
            header={
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Recent Invoices</h2>
                <Link to="/invoices" className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/50">
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Invoice</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Store</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Due</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <Skeleton className="h-4 w-full" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : (recentInvoices?.data ?? []).map((inv) => (
                        <tr
                          key={inv.id}
                          className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <Link
                              to={`/invoices/${inv.id}`}
                              className="text-red-600 hover:text-red-700 font-medium"
                            >
                              {inv.invoiceNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {inv.store?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrency(Number(inv.total), inv.currency)}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                            {formatDate(inv.dueDate)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={inv.status} size="sm" />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Low Stock Alerts */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Low Stock Alerts</h2>
              {(lowStock?.length ?? 0) > 0 && (
                <Badge color="orange">{lowStock?.length}</Badge>
              )}
            </div>
          }
        >
          {lowStockLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !lowStock?.length ? (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-full">
                <CheckCircle className="h-7 w-7 text-green-500 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">All stock healthy</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">No items below threshold</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lowStock.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                      {(item as LowStockItem).kind === 'product'
                        ? (item as LowStockItem).boxTypeName
                        : `${(item as LowStockItem).boxTypeName} – ${(item as LowStockItem).boxSizeName}`
                      }
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {(item as LowStockItem).storeName}
                      {(item as LowStockItem).kind === 'product' && (
                        <span className="ml-1 text-purple-500 dark:text-purple-400">· Product</span>
                      )}
                    </p>
                  </div>
                  <Badge color="orange" className="ml-2 shrink-0">
                    {item.quantity}
                  </Badge>
                </div>
              ))}
              {lowStock.length > 8 && (
                <Link
                  to="/inventory/warehouse"
                  className="block text-center text-xs text-red-600 hover:text-red-700 pt-1"
                >
                  +{lowStock.length - 8} more items
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
