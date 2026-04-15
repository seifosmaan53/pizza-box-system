import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller, Control, UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { invoicesApi } from '@/api/invoices';
import { storesApi } from '@/api/stores';
import { boxTypesApi } from '@/api/boxTypes';
import { inventoryApi } from '@/api/inventory';
import { productsApi } from '@/api/products';
import { formatCurrency, formatDateInput } from '@/utils/formatters';
import type { BoxType, BoxSize, InventoryItem, Product } from '@/types';

// ─── Zod Schema ───────────────────────────────────────────────────────────────

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
  storeId: z.string().min(1, 'Select a store'),
  issueDate: z.string().min(1, 'Required'),
  dueDate: z.string().min(1, 'Required'),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, 'Add at least one line item'),
});

type FormValues = z.infer<typeof schema>;

const STEPS = ['Details & Items', 'Review & Submit'];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
              i < current
                ? 'bg-orange-500 border-orange-500 text-white'
                : i === current
                ? 'border-orange-500 text-orange-500 bg-white dark:bg-gray-800'
                : 'border-gray-300 text-gray-400 bg-white dark:bg-gray-800 dark:border-gray-600'
            }`}
          >
            {i < current ? '✓' : i + 1}
          </div>
          <span
            className={`text-sm font-medium hidden sm:block ${
              i === current
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
          )}
        </div>
      ))}
    </div>
  );
}

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
  storeId: string;
}

function LineItemRow({
  index,
  boxTypes,
  control,
  watch,
  setValue,
  errors,
  onRemove,
  inventoryItems,
  products,
  storeId,
}: LineItemRowProps) {
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

  const selectedItem = inventoryItems.find(
    (it) => it.boxTypeId === boxTypeId && it.boxSizeId === boxSizeId
  );
  const available = selectedItem?.quantity ?? 0;

  // For products, find stock from the products array
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
      {/* Type selector */}
      <div className="flex items-center gap-1.5">
        {typeBtn('box', 'Box')}
        {typeBtn('product', 'Product')}
        {typeBtn('custom', 'Custom')}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-12 gap-3 items-start">
        {/* Item selector */}
        {type === 'box' && (
          <>
            {/* Box Type */}
            <div className="col-span-3">
              <Controller
                control={control}
                name={`lineItems.${index}.boxTypeId`}
                render={({ field }) => (
                  <select
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      setValue(`lineItems.${index}.boxSizeId`, '');
                      setValue(`lineItems.${index}.inventoryItemId`, '');
                      setValue(`lineItems.${index}.unitPrice`, 0);
                    }}
                    className={`w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      rowErrors?.boxTypeId ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <option value="">Box Type…</option>
                    {boxTypes.map((bt) => (
                      <option key={bt.id} value={bt.id}>{bt.name}</option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Box Size */}
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
                      const item = inventoryItems.find(
                        (it) => it.boxTypeId === boxTypeId && it.boxSizeId === e.target.value
                      );
                      if (item) {
                        setValue(`lineItems.${index}.unitPrice`, parseFloat(item.pricePerUnit) || 0);
                        setValue(`lineItems.${index}.inventoryItemId`, item.id);
                      }
                    }}
                    className={`w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 ${
                      rowErrors?.boxSizeId ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <option value="">Box Size…</option>
                    {uniqueSizes.map((bs) => (
                      <option key={bs.id} value={bs.id}>{bs.name}</option>
                    ))}
                  </select>
                )}
              />
              {selectedItem && (
                <p className={`text-xs mt-0.5 ${overStock ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                  Available: {available}
                </p>
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
                  onChange={(e) => {
                    field.onChange(e);
                    const prod = products.find((p) => p.id === e.target.value);
                    if (prod) {
                      setValue(`lineItems.${index}.unitPrice`, parseFloat(prod.unitPrice) || 0);
                    }
                  }}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select Product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                  ))}
                </select>
              )}
            />
            {selectedProduct && productAvailable !== undefined && (
              <p className={`text-xs mt-0.5 ${quantity > productAvailable ? 'text-orange-500' : 'text-green-600 dark:text-green-400'}`}>
                Stock: {productAvailable}
              </p>
            )}
          </div>
        )}

        {type === 'custom' && (
          <div className="col-span-6">
            <Controller
              control={control}
              name={`lineItems.${index}.description`}
              render={({ field }) => (
                <input
                  {...field}
                  type="text"
                  placeholder="Item description…"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              )}
            />
          </div>
        )}

        {/* Quantity */}
        <div className="col-span-2">
          <Controller
            control={control}
            name={`lineItems.${index}.quantity`}
            render={({ field }) => (
              <input
                type="number"
                min={1}
                {...field}
                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                onInput={(e: React.FormEvent<HTMLInputElement>) => {
                  const input = e.currentTarget;
                  if (input.value.length > 1 && input.value.startsWith('0') && input.value[1] !== '.') {
                    input.value = input.value.replace(/^0+/, '') || '0';
                  }
                }}
                className={`w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  overStock || rowErrors?.quantity ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Qty"
              />
            )}
          />
          {overStock && <p className="text-xs text-red-500 mt-0.5">Exceeds stock</p>}
        </div>

        {/* Unit Price */}
        <div className="col-span-2">
          <Controller
            control={control}
            name={`lineItems.${index}.unitPrice`}
            render={({ field }) => (
              <input
                type="number"
                min={0}
                step="0.01"
                {...field}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                onInput={(e: React.FormEvent<HTMLInputElement>) => {
                  const input = e.currentTarget;
                  if (input.value.length > 1 && input.value.startsWith('0') && input.value[1] !== '.') {
                    input.value = input.value.replace(/^0+/, '') || '0';
                  }
                }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Price"
              />
            )}
          />
        </div>

        {/* Line Total */}
        <div className="col-span-2 flex items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatCurrency(lineTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [storeSearch, setStoreSearch] = useState('');
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [applyTax, setApplyTax] = useState(true);
  const [applyShipping, setApplyShipping] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);

  const {
    control,
    watch,
    setValue,
    handleSubmit,
    trigger,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      storeId: '',
      issueDate: formatDateInput(new Date()),
      dueDate: formatDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      notes: '',
      internalNotes: '',
      lineItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  useUnsavedChanges(isDirty);

  const storeId = watch('storeId');
  const lineItems = watch('lineItems');

  const storesQuery = useQuery({
    queryKey: ['stores', { isActive: true }],
    queryFn: () => storesApi.getStores({ isActive: true, limit: 200 }),
  });

  const boxTypesQuery = useQuery({
    queryKey: ['box-types'],
    queryFn: () => boxTypesApi.getBoxTypes(false),
  });

  const inventoryQuery = useQuery({
    queryKey: ['inventory', 'store', storeId],
    queryFn: () => inventoryApi.getStoreInventory(storeId),
    enabled: !!storeId,
  });

  const productsQuery = useQuery({
    queryKey: ['products', { includeInactive: false }],
    queryFn: () => productsApi.getProducts({ includeInactive: false }),
    enabled: !!storeId,
  });

  const selectedStore = storesQuery.data?.data?.find((s) => s.id === storeId);
  const inventoryItems: InventoryItem[] = inventoryQuery.data ?? [];
  const boxTypes: BoxType[] = boxTypesQuery.data ?? [];
  const products: Product[] = productsQuery.data ?? [];
  const taxRate = selectedStore?.taxRate ?? 0;
  const storeDefaultShippingFee = parseFloat(String(selectedStore?.defaultShippingFee ?? '0')) || 0;

  // Update tax/shipping defaults when store changes
  // Depend on storeId (primitive) instead of selectedStore (object ref) to avoid infinite re-renders
  useEffect(() => {
    if (selectedStore) {
      setApplyTax(taxRate > 0);
      const hasShipping = storeDefaultShippingFee > 0;
      setApplyShipping(hasShipping);
      setShippingFee(storeDefaultShippingFee);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxAmount = applyTax ? subtotal * (taxRate / 100) : 0;
  const shippingAmount = applyShipping ? shippingFee : 0;
  const total = subtotal + taxAmount + shippingAmount;

  const anyOverStock = lineItems.some((li) => {
    const item = inventoryItems.find(
      (it) => it.boxTypeId === li.boxTypeId && it.boxSizeId === li.boxSizeId
    );
    return item ? li.quantity > item.quantity : false;
  });

  const hasDuplicates = (() => {
    const keys = lineItems.map((li) => `${li.boxTypeId}|${li.boxSizeId}`);
    return keys.length !== new Set(keys).size;
  })();

  const buildLineItems = (formLineItems: FormValues['lineItems']) =>
    formLineItems.map((li) => {
      if (li.type === 'box') {
        return {
          inventoryItemId: li.inventoryItemId,
          quantityOrdered: li.quantity,
          unitPrice: li.unitPrice,
        };
      } else if (li.type === 'product') {
        return {
          productId: li.productId,
          quantityOrdered: li.quantity,
          unitPrice: li.unitPrice,
        };
      } else {
        return {
          description: li.description ?? '',
          quantityOrdered: li.quantity,
          unitPrice: li.unitPrice,
        };
      }
    });

  const nextNumberQuery = useQuery({
    queryKey: ['invoices', 'next-number'],
    queryFn: () => invoicesApi.getNextNumber(),
  });

  const createMut = useMutation({
    mutationFn: (payload: { data: FormValues; send?: boolean }) =>
      invoicesApi.createInvoice({
        storeId: payload.data.storeId,
        issueDate: payload.data.issueDate,
        dueDate: payload.data.dueDate,
        notes: payload.data.notes,
        internalNotes: payload.data.internalNotes,
        lineItems: buildLineItems(payload.data.lineItems),
        applyTax,
        shippingFee: applyShipping ? shippingFee : 0,
      }),
    onSuccess: async (invoice, variables) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      if (variables.send) {
        try {
          await invoicesApi.sendInvoice(invoice.id);
          toast.success('Invoice created and sent');
        } catch {
          toast.success('Invoice created as draft (send failed)');
        }
      } else {
        toast.success('Invoice saved as draft');
      }
      navigate(`/invoices/${invoice.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stepFields: Array<Array<keyof FormValues>> = [
    ['storeId', 'issueDate', 'dueDate', 'lineItems'],
    [],
  ];

  const nextStep = async () => {
    const valid = await trigger(stepFields[step] as (keyof FormValues)[]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prevStep = () => setStep((s) => Math.max(0, s - 1));

  const filteredStores =
    storesQuery.data?.data?.filter((s) =>
      s.name.toLowerCase().includes(storeSearch.toLowerCase())
    ) ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Invoice</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Fill in the details to create a new invoice
        </p>
      </div>

      <StepIndicator current={step} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            {/* Step 0: Details & Items */}
            {step === 0 && (
              <div className="space-y-6">
                {/* Store selector */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Select Store
                  </h2>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Search stores..."
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {filteredStores.map((store) => (
                        <label
                          key={store.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            storeId === store.id
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <input
                            type="radio"
                            value={store.id}
                            checked={storeId === store.id}
                            onChange={() => setValue('storeId', store.id, { shouldValidate: true })}
                            className="mt-0.5 accent-orange-500"
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{store.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {[store.city, store.state].filter(Boolean).join(', ')}
                            </p>
                            <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span>Tax: <span className="font-medium">{store.taxRate ?? 0}%</span></span>
                              {parseFloat(String(store.defaultShippingFee ?? '0')) > 0 && (
                                <span>Shipping: <span className="font-medium">{formatCurrency(parseFloat(String(store.defaultShippingFee)))}</span></span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                      {filteredStores.length === 0 && (
                        <p className="text-center text-gray-400 py-4">No stores found</p>
                      )}
                    </div>
                    {errors.storeId && (
                      <p className="text-sm text-red-500">{errors.storeId.message}</p>
                    )}
                  </div>
                </div>

                {/* Dates row */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Invoice Details
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Issue Date <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        control={control}
                        name="issueDate"
                        render={({ field }) => (
                          <input
                            type="date"
                            {...field}
                            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                              errors.issueDate ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                            }`}
                          />
                        )}
                      />
                      {errors.issueDate && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.issueDate.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Due Date <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        control={control}
                        name="dueDate"
                        render={({ field }) => (
                          <input
                            type="date"
                            {...field}
                            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                              errors.dueDate ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                            }`}
                          />
                        )}
                      />
                      {errors.dueDate && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.dueDate.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Line Items
                  </h2>

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
                        storeId={storeId}
                      />
                    ))}
                    {fields.length === 0 && (
                      <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                        <p className="text-sm">No line items yet. Click below to add one.</p>
                      </div>
                    )}
                  </div>

                  {hasDuplicates && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      Duplicate box type + size combinations detected.
                    </div>
                  )}

                  {errors.lineItems && !Array.isArray(errors.lineItems) && (
                    <p className="text-sm text-red-500 mt-2">{(errors.lineItems as FieldErrors<FormValues>['lineItems'] & { message?: string })?.message}</p>
                  )}

                  <button
                    type="button"
                    disabled={!storeId || inventoryQuery.isLoading}
                    onClick={() =>
                      append({ type: 'box', inventoryItemId: '', boxTypeId: '', boxSizeId: '', productId: '', description: '', quantity: 1, unitPrice: 0 })
                    }
                    className="mt-4 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 font-medium disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Line Item
                  </button>
                </div>

                {/* Tax & Shipping Toggles */}
                {selectedStore && (
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Tax & Shipping
                    </h2>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyTax}
                        onChange={(e) => setApplyTax(e.target.checked)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500 accent-orange-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Apply Tax ({taxRate}%)
                      </span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyShipping}
                          onChange={(e) => setApplyShipping(e.target.checked)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500 accent-orange-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Apply Shipping Fee
                        </span>
                      </label>
                      {applyShipping && (
                        <div className="ml-6">
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Shipping Fee
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={shippingFee}
                            onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                            className="w-40 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes (visible to customer)
                    </label>
                    <Controller
                      control={control}
                      name="notes"
                      render={({ field }) => (
                        <textarea
                          {...field}
                          rows={2}
                          placeholder="Any notes for the customer..."
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Internal Notes
                    </label>
                    <Controller
                      control={control}
                      name="internalNotes"
                      render={({ field }) => (
                        <textarea
                          {...field}
                          rows={2}
                          placeholder="Internal notes (not shown on invoice)..."
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Review & Submit */}
            {step === 1 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Review Invoice
                </h2>
                {nextNumberQuery.data?.nextNumber && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Invoice number: <span className="font-mono font-semibold text-gray-900 dark:text-white">{nextNumberQuery.data.nextNumber}</span>
                  </p>
                )}
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Store</span>
                      <p className="font-medium text-gray-900 dark:text-white mt-0.5">{selectedStore?.name ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Location</span>
                      <p className="font-medium text-gray-900 dark:text-white mt-0.5">
                        {selectedStore ? [selectedStore.city, selectedStore.state].filter(Boolean).join(', ') : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Issue Date</span>
                      <p className="font-medium text-gray-900 dark:text-white mt-0.5">{watch('issueDate')}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Due Date</span>
                      <p className="font-medium text-gray-900 dark:text-white mt-0.5">{watch('dueDate')}</p>
                    </div>
                  </div>

                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">Item</th>
                        <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Qty</th>
                        <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Unit Price</th>
                        <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((li, i) => {
                        let itemLabel = '—';
                        if (li.type === 'box') {
                          const bt = boxTypes.find((b) => b.id === li.boxTypeId);
                          const inv = inventoryItems.find(
                            (it) => it.boxTypeId === li.boxTypeId && it.boxSizeId === li.boxSizeId
                          );
                          itemLabel = [bt?.name, inv?.boxSize?.name].filter(Boolean).join(' — ') || '—';
                        } else if (li.type === 'product') {
                          const prod = products.find((p) => p.id === li.productId);
                          itemLabel = prod?.name ?? '—';
                        } else {
                          itemLabel = li.description || '(custom item)';
                        }
                        return (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2 text-gray-700 dark:text-gray-300">{itemLabel}</td>
                            <td className="py-2 text-right text-gray-700 dark:text-gray-300">{li.quantity}</td>
                            <td className="py-2 text-right text-gray-700 dark:text-gray-300">
                              {formatCurrency(li.unitPrice)}
                            </td>
                            <td className="py-2 text-right font-medium text-gray-900 dark:text-white">
                              {formatCurrency(li.quantity * li.unitPrice)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Review totals breakdown */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {applyTax && (
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>Tax ({taxRate}%)</span>
                        <span>{formatCurrency(taxAmount)}</span>
                      </div>
                    )}
                    {applyShipping && (
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>Shipping</span>
                        <span>{formatCurrency(shippingAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-gray-900 dark:text-white text-base pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  {watch('notes') && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <span className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Notes</span>
                      <p className="text-gray-700 dark:text-gray-300 mt-0.5">{watch('notes')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={prevStep}
                disabled={step === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              {step < STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Summary</h3>

            {lineItems.length > 0 ? (
              <div className="space-y-1 text-sm">
                {lineItems.map((li, i) => {
                  let label = '—';
                  if (li.type === 'box') {
                    const bt = boxTypes.find((b) => b.id === li.boxTypeId);
                    label = bt?.name ?? '—';
                  } else if (li.type === 'product') {
                    label = products.find((p) => p.id === li.productId)?.name ?? '—';
                  } else {
                    label = li.description || 'Custom';
                  }
                  return (
                    <div key={i} className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span className="truncate pr-2">{label} × {li.quantity}</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {formatCurrency(li.quantity * li.unitPrice)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No items yet</p>
            )}

            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {applyTax && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Tax ({taxRate}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              {applyShipping && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Shipping</span>
                  <span>{formatCurrency(shippingAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 dark:text-white text-base pt-1 border-t border-gray-100 dark:border-gray-700">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {anyOverStock && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Items exceed available stock.
              </div>
            )}

            {step === STEPS.length - 1 && (
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleSubmit((data) => createMut.mutate({ data }))}
                  disabled={createMut.isPending}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {createMut.isPending ? 'Saving…' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!anyOverStock && !hasDuplicates && lineItems.length > 0) {
                      setShowSendConfirm(true);
                    }
                  }}
                  disabled={createMut.isPending || anyOverStock || hasDuplicates || lineItems.length === 0}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Invoice
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Send confirmation */}
      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Send Invoice?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will create the invoice and immediately send it. Inventory will be deducted for
              all line items. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSendConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSendConfirm(false);
                  handleSubmit((data) => createMut.mutate({ data, send: true }))();
                }}
                disabled={createMut.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50"
              >
                {createMut.isPending ? 'Sending…' : 'Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
