import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getSalesByStore, getSalesByBoxType, getSalesByBoxSize, getRevenueOverTime, getTopStores, getInvoiceSummary } from '@/api/analytics';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Skeleton from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/formatters';
import { TrendingUp, DollarSign, Package, ShoppingCart, Calendar } from 'lucide-react';
import { CHART_COLORS, CHART_AXIS_TICK, CHART_GRID_STYLE, CHART_TOOLTIP_STYLE } from '@/utils/constants';

const COLORS = CHART_COLORS;
const AXIS_TICK = CHART_AXIS_TICK;
const GRID_STYLE = CHART_GRID_STYLE;
const TOOLTIP_STYLE = CHART_TOOLTIP_STYLE;

const DATE_PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '12m', days: 365 },
];

export default function SalesAnalytics() {
  const [preset, setPreset] = useState<number | null>(30);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('week');

  const startDate = preset
    ? new Date(Date.now() - preset * 24 * 60 * 60 * 1000).toISOString()
    : customStart ? new Date(customStart).toISOString() : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = preset
    ? new Date().toISOString()
    : customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : new Date().toISOString();

  const params = { startDate, endDate };
  const dateKey = preset ?? `${customStart}_${customEnd}`;

  const revenueQuery = useQuery({ queryKey: ['analytics', 'revenue', dateKey, groupBy], queryFn: () => getRevenueOverTime({ ...params, groupBy }) });
  const byStoreQuery = useQuery({ queryKey: ['analytics', 'by-store', dateKey], queryFn: () => getSalesByStore(params) });
  const byTypeQuery = useQuery({ queryKey: ['analytics', 'by-type', dateKey], queryFn: () => getSalesByBoxType(params) });
  const bySizeQuery = useQuery({ queryKey: ['analytics', 'by-size', dateKey], queryFn: () => getSalesByBoxSize(params) });
  const topStoresQuery = useQuery({ queryKey: ['analytics', 'top-stores'], queryFn: () => getTopStores({ limit: 10 }) });
  const summaryQuery = useQuery({ queryKey: ['analytics', 'summary', dateKey], queryFn: () => getInvoiceSummary(params) });

  const revenue = revenueQuery.data || [];
  const byStore = byStoreQuery.data || [];
  const byType = byTypeQuery.data || [];
  const bySize = bySizeQuery.data || [];
  const topStores = topStoresQuery.data || [];
  const summary = summaryQuery.data;

  const totalRevenue = byStore.reduce((sum: number, s: { revenue: number }) => sum + Number(s.revenue), 0);
  const totalUnits = byStore.reduce((sum: number, s: { unitsSold: number }) => sum + Number(s.unitsSold), 0);
  const paidRevenue = Number(summary?.PAID?.value || 0);

  const bestStore = topStores[0];
  const worstStore = topStores[topStores.length - 1];

  return (
    <div>
      <PageHeader title="Analytics" breadcrumbs={[{ label: 'Analytics' }]} />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => { setPreset(p.days); setCustomStart(''); setCustomEnd(''); }}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                preset === p.days ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <input
            type="date"
            value={customStart}
            onChange={(e) => { setCustomStart(e.target.value); setPreset(null); }}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            aria-label="Start date"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => { setCustomEnd(e.target.value); setPreset(null); }}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            aria-label="End date"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['day', 'week', 'month'] as const).map((g) => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                groupBy === g ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
              }`}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} color="green" isLoading={byStoreQuery.isLoading} />
        <StatCard label="Units Sold" value={totalUnits.toLocaleString()} icon={Package} color="blue" isLoading={byStoreQuery.isLoading} />
        <StatCard label="Paid Revenue" value={formatCurrency(paidRevenue)} icon={TrendingUp} color="purple" isLoading={summaryQuery.isLoading} />
        <StatCard label="Active Stores" value={topStores.length.toString()} icon={ShoppingCart} color="orange" isLoading={topStoresQuery.isLoading} />
      </div>

      {/* Best / Worst store cards */}
      {bestStore && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
            <div className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Best Performer</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{bestStore.storeName}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{bestStore.unitsSold} units · {formatCurrency(Number(bestStore.revenue))} revenue</div>
          </div>
          {worstStore && worstStore.storeId !== bestStore.storeId && (
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
              <div className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Needs Attention</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{worstStore.storeName}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{worstStore.unitsSold} units · {formatCurrency(Number(worstStore.revenue))} revenue</div>
            </div>
          )}
        </div>
      )}

      {/* Revenue over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="font-semibold text-gray-900 dark:text-white mb-4">Revenue Over Time</div>
          {revenueQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenue}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="period" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="#ef4444" strokeWidth={2} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div className="font-semibold text-gray-900 dark:text-white mb-4">Units Sold Over Time</div>
          {revenueQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenue}>
                <CartesianGrid {...GRID_STYLE} />
                <XAxis dataKey="period" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="unitsSold" stroke="#3b82f6" strokeWidth={2} dot={false} name="Units" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Sales by store bar chart */}
        <div className="lg:col-span-2">
          <Card>
            <div className="font-semibold text-gray-900 dark:text-white mb-4">Revenue by Store (Top 10)</div>
            {byStoreQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byStore.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid {...GRID_STYLE} />
                  <XAxis type="number" tick={AXIS_TICK} />
                  <YAxis type="category" dataKey="storeName" tick={AXIS_TICK} width={110} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(Number(v))} />
                  <Bar dataKey="revenue" fill="#ef4444" name="Revenue" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Revenue by box type donut */}
        <Card>
          <div className="font-semibold text-gray-900 dark:text-white mb-4">Revenue by Box Type</div>
          {byTypeQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="revenue" nameKey="boxType">
                  {byType.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Revenue by box size */}
        <Card>
          <div className="font-semibold text-gray-900 dark:text-white mb-4">Revenue by Box Size</div>
          {bySizeQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={bySize} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="revenue" nameKey="boxSize">
                  {bySize.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Store comparison table */}
        <div className="lg:col-span-2">
          <Card>
            <div className="font-semibold text-gray-900 dark:text-white mb-4">Store Comparison</div>
            {topStoresQuery.isLoading ? <Skeleton className="h-48 w-full" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2 text-left text-gray-500 dark:text-gray-400 font-medium">Store</th>
                      <th className="pb-2 text-right text-gray-500 dark:text-gray-400 font-medium">Units</th>
                      <th className="pb-2 text-right text-gray-500 dark:text-gray-400 font-medium">Revenue</th>
                      <th className="pb-2 text-right text-gray-500 dark:text-gray-400 font-medium">Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {topStores.map((s: { storeId: string; storeName: string; unitsSold: number; revenue: number; invoiceCount: number }) => (
                      <tr key={s.storeId}>
                        <td className="py-2 text-gray-900 dark:text-white">{s.storeName}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-400">{s.unitsSold.toLocaleString()}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(Number(s.revenue))}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-400">{s.invoiceCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
