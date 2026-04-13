import React, { forwardRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  clearable?: boolean;
  onChange?: (value: string) => void;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      clearable,
      onChange,
      containerClassName,
      className,
      value,
      required,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange?.('');
    };

    return (
      <div className={cn('flex flex-col gap-1', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-sm bg-white text-gray-900 appearance-none transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent',
              'dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900',
              error
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-300 dark:border-gray-600',
              clearable && value ? 'pr-16' : 'pr-9',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
            {clearable && value && (
              <button
                type="button"
                onClick={handleClear}
                className="pointer-events-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {!error && helperText && <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
