import React, { forwardRef } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/utils/cn';

interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, helperText, containerClassName, className, required, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Calendar className="h-4 w-4" />
          </div>
          <input
            ref={ref}
            id={inputId}
            type="date"
            className={cn(
              'w-full rounded-lg border pl-9 pr-3 py-2 text-sm text-gray-900 bg-white transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent',
              'dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-300 dark:border-gray-600',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {!error && helperText && <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

export default DatePicker;
