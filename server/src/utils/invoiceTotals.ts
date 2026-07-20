import Decimal from 'decimal.js';

/**
 * Money arithmetic for invoices.
 *
 * All invoice math runs through Decimal.js rather than native JS numbers so that
 * repeated addition of line items and percentage-based tax never accumulates
 * floating-point error (e.g. `0.1 + 0.2 !== 0.3`). These helpers are the single
 * source of truth for how a subtotal, tax amount and grand total are derived,
 * and are used by both invoice creation and update so the two paths can never
 * drift apart.
 */

export type DecimalLike = Decimal | number | string;

export interface LineItemLike {
  unitPrice: DecimalLike;
  quantityOrdered: number;
}

export interface InvoiceTotals {
  subtotal: Decimal;
  taxAmount: Decimal;
  shippingFee: Decimal;
  total: Decimal;
}

/** Line total for a single row: unit price × quantity. */
export function lineItemTotal(unitPrice: DecimalLike, quantityOrdered: number): Decimal {
  return new Decimal(unitPrice).times(quantityOrdered);
}

/** Sum of every line item's `unitPrice × quantityOrdered`. */
export function sumLineItems(lineItems: LineItemLike[]): Decimal {
  return lineItems.reduce(
    (acc, li) => acc.plus(lineItemTotal(li.unitPrice, li.quantityOrdered)),
    new Decimal(0),
  );
}

/**
 * Derive tax, shipping and grand total from a subtotal.
 *
 * @param subtotal        sum of line items (Decimal or numeric-like)
 * @param taxRatePercent  tax rate expressed as a percentage, e.g. `8.25` for 8.25%
 * @param shippingFee     flat shipping fee added after tax (defaults to 0)
 */
export function computeInvoiceTotals(
  subtotal: DecimalLike,
  taxRatePercent: DecimalLike,
  shippingFee: DecimalLike = 0,
): InvoiceTotals {
  const sub = new Decimal(subtotal);
  const taxAmount = sub.times(taxRatePercent).dividedBy(100);
  const fee = new Decimal(shippingFee);
  const total = sub.plus(taxAmount).plus(fee);
  return { subtotal: sub, taxAmount, shippingFee: fee, total };
}
