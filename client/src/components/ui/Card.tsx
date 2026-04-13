import React from 'react';
import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, header, footer, padding = true, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
    >
      {header && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">{header}</div>
      )}
      <div className={cn(padding && 'p-6')}>{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
