import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller, Control, UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, AlertTriangle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { invoicesApi } from '@/api/invoices';
import { boxTypesApi } from '@/api/boxTypes';
import { inventoryApi } from '@/api/inventory';
import { productsApi } from '@/api/products';
import { formatCurrency, formatDateInput } from '@/utils/formatters';
import Skeleton from '@/components/ui/Skeleton';
import type { BoxType, BoxSize, InventoryItem, Product, Invoice } from '@/types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const lineItemSchema = z.object({
  type: z.enum(['box', 'product', 'custom']),
  inventoryItemId: z.string().optional(),
  boxTypeId: z.string().optional(),
  boxSizeId: z.string().optional(),
  productId: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number({ invalid_type_error: 'Enter quantity' }).int().min(1, 'Min 1'),
  unitPrice: z.number({ invalid_type_error: 'Enter price' }).min(0),
});

const schema = z.object({
  dueDate: z.string().min(1, 'Required'),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'Add at least one line item'),
});

type FormValues = z.infer<typeof schema>;

// ─── Line item row ────────────────────────────────────────────────────────────

interface LineItemRowProps {
  index: number;
  boxTypes: BoxType[];
  control: Control<FormValues>;
  watch: UseFormWatch<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  errors: FieldErrors<FormValues>;
  onRemove: () => void;
  inventoryItems: InventoryItem[];
  products: Product[];
  currency: string;
  storeId: string;
}

function LineItemRow({ index, boxTypes, control, watch, setValue, errors, onRemove, inventoryItems, products, currency, storeId }: LineItemRowProps) {
  const type = watch(`lineItems.${index}.type`) as 'box' | 'product' | 'custom';
  const boxTypeId = watch(`lineItems.${index}.boxTypeId`);
  const boxSizeId = watch(`lineItems.${index}.boxSizeId`);
  const productId = watch(`lineItems.${index}.productId`);
  const quantity = watch(`lineItems.${index}.quantity`) || 0;
  const unitPrice = watch(`lineItems.${index}.unitPrice`) || 0;

  const uniqueSizes = Array.from(
    new Map(
      inventoryItems
        .filter((item) => item.boxTypeId === boxTypeId && item.boxSize)
        .map((item) => [item.boxSize!.id, item.boxSize!])
    ).values()
  ) as BoxSize[];

  const selectedItem = inventoryItems.find((it) => it.boxTypeId === boxTypeId && it.boxSizeId === boxSizeId);
  const available = selectedItem?.quantity ?? 0;
  const selectedProduct = products.find((p) => p.id === productId);
  const productStock = selectedProduct?.stock?.find((s) => s.storeId === storeId);
  const productAvailable = productStock?.quantity;
  const lineTotal = quantity * unitPrice;
  const overStock = type === 'box' && !!selectedItem && quantity > available;
  const rowErrors = errors?.lineItems?.[index];

  const typeBtn = (t: 'box' | 'product' | 'custom', label: string) => (
    <button
      type="button"
      onClick={() => {
        setValue(`lineItems.${index}.type`, t);
        setValue(`lineItems.${index}.inventoryItemId`, '');
        setValue(`lineItems.${index}.boxTypeId`, '');
        setValue(`lineItems.${index}.boxSizeId`, '');
        setValue(`lineItems.${index}.productId`, '');
        setValue(`lineItems.${index}.description`, '');
        setValue(`lineItems.${index}.unitPrice`, 0);
      }}
      className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
        type === t
          ? 'bg-orange-500 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
      <div className="flex items-center gap-1.5">
        {typeBtn('box', 'Box')}
        {typeBtn('product', 'Product')}
        {typeBtn('custom', 'Custom')}
        <div className="flex-1" />
        <button type="button" onClick={onRemove} className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-12 gap-3 items-start">
        {type === 'box' && (
          <>
            <div className="col-span-3">
              <Controller
                control={control}
                name={`lineItems.${index}.boxTypeId`}
                render={({ field }) => (
                  <select
                    {...field}
                    onChange={(e) => { field.onChange(e); setValue(`lineItems.${index}.boxSizeId`, ''); setValue(`lineItems.${index}.inventoryItemId`, ''); setValue(`lineItems.${index}.unitPrice`, 0); }}
                    className={`w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${rowErrors?.boxTypeId ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                  >
                    <option value="">Box Type…</option>
                    {boxTypes.map((bt) => <option key={bt.id} value={bt.id}>{bt.name}</option>)}
                  </select>
                )}
              />
            </div>
            <div className="col-span-3">
              <Controller
                control={control}
                name={`lineItems.${index}.boxSizeId`}
                render={({ field }) => (
                  <select
                    {...field}
                    disabled={!boxTypeId}
                    onChange={(e) => {
                      field.onChange(e);
                      const item = inventoryItems.find((it) => it.boxTypeId === boxTypeId && it.boxSizeId === e.target.value);
                      if (item) { setValue(`lineItems.${index}.unitPrice`, parseFloat(item.pricePerUnit) || 0); setValue(`lineItems.${index}.inventoryItemId`, item.id); }
                    }}
                    className={`w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 ${rowErrors?.boxSizeId ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                  >
                    <option value="">Box Size…</option>
                    {uniqueSizes.map((bs) => <option key={bs.id} value={bs.id}>{bs.name}</option>)}
                  </select>
                )}
              />
              {selectedItem && (
                <p className={`text-xs mt-0.5 ${overStock ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>Available: {available}</p>
              )}
            </div>
          </>
        )}

        {type === 'product' && (
          <div className="col-span-6">
            <Controller
              control={control}
              name={`lineItems.${index}.productId`}
              render={({ field }) => (
                <select
                  {...field}
                  onChange={(e) => { field.onChange(e); const prod = products.find((p) => p.id === e.target.value); if (prod) setValue(`lineItems.${index}.unitPrice`, parseFloat(prod.unitPrice) || 0); }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select Product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                </select>
              )}
            />
            {selectedProduct && productAvailable !== undefined && (
              <p className={`text-xs mt-0.5 ${quantity > productAvailable ? 'text-orange-500' : 'text-green-600 dark:text-green-400'}`}>Stock: {productAvailable}</p>
            )}
          </div>
        )}

        {type === 'custom' && (
          <div className="col-span-6">
            <Controller
              control={control}
              name={`lineItems.${index}.description`}
              render={({ field }) => (
                <input {...field} type="text" placeholder="Item description…" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
              )}
            />
          </div>
        )}

        <div className="col-span-2">
          <Controller
            control={control}
            name={`lineItems.${index}.quantity`}
            render={({ field }) => (
              <input
                type="number" min={1} {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                onInput={(e: React.FormEvent<HTMLInputElement>) => { const el = e.currentTarget; if (el.value.length > 1 && el.value.startsWith('0') && el.value[1] !== '.') el.value = el.value.replace(/^0+/, '') || '0'; }}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${overStock ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                placeholder="Qty"
              />
            )}
          />
          {overStock && <p className="text-xs text-red-500 mt-0.5">Exceeds stock</p>}
        </div>

        <div className="col-span-2">
          <Controller
            control={control}
            name={`lineItems.${index}.unitPrice`}
            render={({ field }) => (
              <input
                type="number" min={0} step="0.01" {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                onInput={(e: React.FormEvent<HTMLInputElement>) => { const el = e.currentTarget; if (el.value.length > 1 && el.value.startsWith('0') && el.value[1] !== '.') el.value = el.value.replace(/^0+/, '') || '0'; }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Price"
              />
            )}
          />
        </div>

        <div className="col-span-1 flex items-center pt-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatCurrency(lineTotal)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const invoiceQuery = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.getInvoice(id!),
    enabled: !!id,
  });

  const invoice = invoiceQuery.data as Invoice | undefined;

  const boxTypesQuery = useQuery({
    queryKey: ['box-types'],
    queryFn: () => boxTypesApi.getBoxTypes(false),
  });

  const inventoryQuery = useQuery({
    queryKey: ['inventory', 'store', invoice?.storeId],
    queryFn: () => inventoryApi.getStoreInventory(invoice!.storeId),
    enabled: !!invoice?.storeId,
  });

  const productsQuery = useQuery({
    queryKey: ['products', { includeInactive: false }],
    queryFn: () => productsApi.getProducts({ includeInactive: false }),
    enabled: !!invoice?.storeId,
  });

  const { control, watch, setValue, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { dueDate: '', notes: '', internalNotes: '', lineItems: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const lineItems = watch('lineItems');

  useEffect(() => {
    if (invoice) {
      reset({
        dueDate: formatDateInput(invoice.dueDate),
        notes: invoice.notes ?? '',
        internalNotes: invoice.internalNotes ?? '',
        lineItems: (invoice.lineItems ?? []).map((li) => {
          if (li.inventoryItemId) {
            return {
              type: 'box' as const,
              inventoryItemId: li.inventoryItemId,
              boxTypeId: li.inventoryItem?.boxTypeId ?? '',
              boxSizeId: li.inventoryItem?.boxSizeId ?? '',
              quantity: li.quantityOrdered,
              unitPrice: Number(li.unitPrice),
            };
          } else if (li.productId) {
            return {
              type: 'product' as const,
              productId: li.productId,
              quantity: li.quantityOrdered,
              unitPrice: Number(li.unitPrice),
            };
          } else {
            return {
              type: 'custom' as const,
              description: li.description,
              quantity: li.quantityOrdered,
              unitPrice: Number(li.unitPrice),
            };
          }
        }),
      });
    }
  }, [invoice, reset]);

  const inventoryItems: InventoryItem[] = inventoryQuery.data ?? [];
  const boxTypes: BoxType[] = boxTypesQuery.data ?? [];
  const products: Product[] = productsQuery.data ?? [];
  const currency = invoice?.currency ?? 'USD';
  const taxRate = Number(invoice?.taxRate ?? 0);

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const anyOverStock = lineItems.some((li) => {
    const item = inventoryItems.find((it) => it.boxTypeId === li.boxTypeId && it.boxSizeId === li.boxSizeId);
    return item ? li.quantity > item.quantity : false;
  });

  const buildLineItems = (formLineItems: FormValues['lineItems']) =>
    formLineItems.map((li) => {
      if (li.type === 'box') {
        return { inventoryItemId: li.inventoryItemId, quantityOrdered: li.quantity, unitPrice: li.unitPrice };
      } else if (li.type === 'product') {
        return { productId: li.productId, quantityOrdered: li.quantity, unitPrice: li.unitPrice };
      } else {
        return { description: li.description ?? '', quantityOrdered: li.quantity, unitPrice: li.unitPrice };
      }
    });

  const updateMut = useMutation({
    mutationFn: (data: FormValues) =>
      invoicesApi.updateInvoice(id!, {
        dueDate: data.dueDate,
        notes: data.notes,
        internalNotes: data.internalNotes,
        lineItems: buildLineItems(data.lineItems),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice updated');
      navigate(`/invoices/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (invoiceQuery.isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500">Invoice not found.</p>
      </div>
    );
  }

  if (invoice.status !== 'DRAFT') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-orange-500 mx-auto mb-3" />
          <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Cannot Edit Invoice</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Only DRAFT invoices can be edited. This invoice is <span className="font-medium">{invoice.status}</span>.
          </p>
          <button onClick={() => navigate(`/invoices/${id}`)} className="mt-4 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg">
            View Invoice
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/invoices/${id}`)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Invoice <span className="font-mono text-orange-500">{invoice.invoiceNumber}</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Store: {invoice.store?.name} · Currency: {currency} · Tax: {taxRate}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Dates & notes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Invoice Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date <span className="text-red-500">*</span></label>
              <Controller
                control={control}
                name="dueDate"
                render={({ field }) => (
                  <input type="date" {...field} className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors.dueDate ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`} />
                )}
              />
              {errors.dueDate && <p className="text-xs text-red-500 mt-0.5">{errors.dueDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (visible to customer)</label>
              <Controller control={control} name="notes" render={({ field }) => (
                <textarea {...field} rows={3} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
              )} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Internal Notes</label>
              <Controller control={control} name="internalNotes" render={({ field }) => (
                <textarea {...field} rows={3} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
              )} />
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Line Items</h2>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <LineItemRow
                  key={field.id}
                  index={index}
                  boxTypes={boxTypes}
                  control={control}
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                  onRemove={() => remove(index)}
                  inventoryItems={inventoryItems}
                  products={products}
                  currency={currency}
                  storeId={invoice.storeId}
                />
              ))}
              {fields.length === 0 && (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-sm">No line items. Add one below.</p>
                </div>
              )}
            </div>
            {errors.lineItems && !Array.isArray(errors.lineItems) && (
              <p className="text-sm text-red-500 mt-2">{(errors.lineItems as FieldErrors<FormValues>['lineItems'] & { message?: string })?.message}</p>
            )}
            <button
              type="button"
              onClick={() => append({ type: 'box', inventoryItemId: '', boxTypeId: '', boxSizeId: '', quantity: 1, unitPrice: 0 })}
              className="mt-4 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Line Item
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Summary</h3>
            {lineItems.length > 0 ? (
              <div className="space-y-1 text-sm">
                {lineItems.map((li, i) => {
                  const label = li.type === 'box'
                    ? boxTypes.find((b) => b.id === li.boxTypeId)?.name ?? 'Box item'
                    : li.type === 'product'
                    ? products.find((p) => p.id === li.productId)?.name ?? 'Product'
                    : li.description || 'Custom item';
                  return (
                    <div key={i} className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span className="truncate pr-2">{label} × {li.quantity}</span>
                      <span className="whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                        {formatCurrency(li.quantity * li.unitPrice)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No items</p>
            )}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Tax ({taxRate}%)</span><span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 dark:text-white text-base pt-1 border-t border-gray-100 dark:border-gray-700">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
            {anyOverStock && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Items exceed available stock.
              </div>
            )}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSubmit((data) => updateMut.mutate(data))}
                disabled={updateMut.isPending}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {updateMut.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => navigate(`/invoices/${id}`)} className="w-full py-2 px-4 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
