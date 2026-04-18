import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { US_STATES } from '@/utils/constants';
import type { Store } from '@/types';

// Strip everything except digits from a phone string
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

// Format a digit string as (xxx) xxx-xxxx
function formatPhone(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string()
    .refine((v) => !v || phoneRegex.test(v), { message: 'Phone must be a valid US number: (xxx) xxx-xxxx' })
    .optional()
    .or(z.literal('')),
  taxRate: z.number().min(0).max(100).optional(),
  defaultShippingFee: z.number().min(0).optional(),
});

export type StoreFormData = z.infer<typeof schema>;

interface StoreFormProps {
  defaultValues?: Partial<Store>;
  onSubmit: (data: StoreFormData) => void;
  isLoading?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}

export function StoreForm({
  defaultValues,
  onSubmit,
  isLoading,
  onCancel,
  submitLabel = 'Save',
}: StoreFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StoreFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      address: defaultValues?.address ?? '',
      city: defaultValues?.city ?? '',
      state: defaultValues?.state ?? '',
      zipCode: defaultValues?.zipCode ?? '',
      contactName: defaultValues?.contactName ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ? formatPhone(defaultValues.phone) : '',
      taxRate: defaultValues?.taxRate ?? 0,
      defaultShippingFee: defaultValues?.defaultShippingFee ? Number(defaultValues.defaultShippingFee) : 0,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Store Name"
        required
        error={errors.name?.message}
        placeholder="e.g. Downtown Branch"
        {...register('name')}
      />
      <Input
        label="Address"
        error={errors.address?.message}
        placeholder="Street address"
        {...register('address')}
      />
      <div className="grid grid-cols-3 gap-4">
        <Input
          label="City"
          error={errors.city?.message}
          placeholder="City"
          {...register('city')}
        />
        <Select
          label="State"
          options={US_STATES.map((s) => ({ value: s.code, label: s.name }))}
          placeholder="Select state"
          value={watch('state') ?? ''}
          onChange={(v) => setValue('state', v)}
          error={errors.state?.message}
          clearable
        />
        <Input
          label="Zip Code"
          error={errors.zipCode?.message}
          placeholder="e.g. 10001"
          {...register('zipCode')}
        />
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Contact Information
        </p>
        <div className="space-y-4">
          <Input
            label="Contact Name"
            error={errors.contactName?.message}
            placeholder="Full name"
            {...register('contactName')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Email"
              type="email"
              error={errors.email?.message}
              placeholder="contact@store.com"
              {...register('email')}
            />
            <Input
              label="Contact Phone"
              type="tel"
              error={errors.phone?.message}
              placeholder="(555) 000-0000"
              maxLength={14}
              value={watch('phone') ?? ''}
              onChange={(e) => {
                const formatted = formatPhone(e.target.value);
                setValue('phone', formatted, { shouldValidate: true });
              }}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Billing Defaults
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Default Tax Rate (%)"
            type="number"
            step="0.01"
            min={0}
            max={100}
            error={errors.taxRate?.message}
            placeholder="e.g. 8.25"
            {...register('taxRate', { valueAsNumber: true })}
          />
          <Input
            label="Default Shipping Fee ($)"
            type="number"
            step="0.01"
            min={0}
            max={10000}
            error={errors.defaultShippingFee?.message}
            placeholder="e.g. 25.00"
            {...register('defaultShippingFee', { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
