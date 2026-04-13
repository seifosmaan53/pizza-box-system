import React from 'react';
import { cn } from '@/utils/cn';

type BadgeColor = 'gray' | 'blue' | 'green' | 'red' | 'orange' | 'yellow' | 'purple';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  color?: BadgeColor;
  size?: BadgeSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const colorClasses: Record<BadgeColor, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-600',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const dotColorClasses: Record<BadgeColor, string> = {
  gray: 'bg-gray-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
};

export function Badge({ color = 'gray', size = 'md', children, icon, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        colorClasses[color],
        sizeClasses[size],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColorClasses[color])} />}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

export default Badge;
