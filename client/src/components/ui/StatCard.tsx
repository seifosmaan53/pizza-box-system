import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Skeleton } from './Skeleton';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  color?: 'red' | 'blue' | 'green' | 'orange' | 'purple' | 'gray';
  trend?: number; // positive = up, negative = down
  trendLabel?: string;
  isLoading?: boolean;
  className?: string;
  valueClassName?: string;
  iconClassName?: string;
  animateNumber?: boolean;
  prefix?: string;
  suffix?: string;
  onClick?: () => void;
}

function useCountUp(target: number, duration = 800, enabled = true) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || typeof target !== 'number') {
      setCount(target);
      return;
    }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, enabled]);

  return count;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  isLoading,
  className,
  valueClassName,
  iconClassName,
  animateNumber = true,
  prefix,
  suffix,
  onClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  color,
}: StatCardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericValue);
  const animatedValue = useCountUp(isNumeric ? numericValue : 0, 800, animateNumber && isNumeric);

  const displayValue = isLoading
    ? null
    : isNumeric && animateNumber
    ? `${prefix ?? ''}${animatedValue.toLocaleString()}${suffix ?? ''}`
    : value;

  const trendIcon =
    trend === undefined ? null : trend > 0 ? (
      <TrendingUp className="h-3.5 w-3.5" />
    ) : trend < 0 ? (
      <TrendingDown className="h-3.5 w-3.5" />
    ) : (
      <Minus className="h-3.5 w-3.5" />
    );

  const trendColor =
    trend === undefined
      ? ''
      : trend > 0
      ? 'text-green-600 dark:text-green-400'
      : trend < 0
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-500 dark:text-gray-400';

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 truncate">
            {label}
          </p>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ) : (
            <>
              <p
                className={cn(
                  'text-2xl font-bold text-gray-900 dark:text-gray-100 truncate',
                  valueClassName
                )}
              >
                {displayValue}
              </p>
              {(trend !== undefined || trendLabel) && (
                <div className={cn('mt-1.5 flex items-center gap-1 text-xs font-medium', trendColor)}>
                  {trendIcon}
                  <span>
                    {trend !== undefined && `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`}
                    {trendLabel && ` ${trendLabel}`}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 shrink-0',
              iconClassName
            )}
          >
            {React.isValidElement(icon)
              ? icon
              : React.createElement(icon as React.ComponentType<{ className?: string }>, { className: 'h-5 w-5' })}
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
