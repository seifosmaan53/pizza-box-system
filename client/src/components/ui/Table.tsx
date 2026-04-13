import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  // Pagination
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  total?: number;
  pageSize?: number;
}

const SKELETON_ROWS = 5;

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyMessage = 'No records found',
  emptyIcon,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  rowClassName,
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
}: TableProps<T>) {
  const renderSortIcon = (key: string) => {
    if (sortBy !== key) return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-3.5 w-3.5 text-red-500" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-red-500" />
    );
  };

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap bg-gray-50 dark:bg-gray-800/50',
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left',
                    col.sortable && 'cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 select-none'
                  )}
                  onClick={col.sortable ? () => onSort?.(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && renderSortIcon(col.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
              ? (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600">
                        {emptyIcon}
                        <span>{emptyMessage}</span>
                      </div>
                    </td>
                  </tr>
                )
              : data.map((row) => (
                  <tr
                    key={keyExtractor(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-gray-100 dark:border-gray-800 transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      rowClassName?.(row)
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-gray-700 dark:text-gray-300',
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        )}
                      >
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {page !== undefined && totalPages !== undefined && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {total !== undefined && pageSize !== undefined
              ? `Showing ${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} of ${total}`
              : `Page ${page} of ${totalPages}`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg transition-colors',
                    p === page
                      ? 'bg-red-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Table;
