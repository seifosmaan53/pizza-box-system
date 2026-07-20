import Decimal from 'decimal.js';
import {
  lineItemTotal,
  sumLineItems,
  computeInvoiceTotals,
} from '../utils/invoiceTotals';

describe('lineItemTotal', () => {
  it('multiplies unit price by quantity', () => {
    expect(lineItemTotal('2.50', 4).toString()).toBe('10');
  });

  it('accepts a Decimal unit price', () => {
    expect(lineItemTotal(new Decimal('1.99'), 3).toString()).toBe('5.97');
  });
});

describe('sumLineItems', () => {
  it('returns zero for an empty invoice', () => {
    expect(sumLineItems([]).toString()).toBe('0');
  });

  it('sums multiple line items', () => {
    const subtotal = sumLineItems([
      { unitPrice: '10.00', quantityOrdered: 2 },
      { unitPrice: '3.50', quantityOrdered: 4 },
    ]);
    expect(subtotal.toString()).toBe('34');
  });

  it('does not accumulate floating-point error over many rows', () => {
    // 0.1 + 0.2 !== 0.3 in native JS; Decimal must keep it exact.
    const subtotal = sumLineItems([
      { unitPrice: '0.10', quantityOrdered: 1 },
      { unitPrice: '0.20', quantityOrdered: 1 },
    ]);
    expect(subtotal.toString()).toBe('0.3');
    expect(subtotal.equals(new Decimal('0.3'))).toBe(true);
  });
});

describe('computeInvoiceTotals', () => {
  it('applies a percentage tax rate and flat shipping fee', () => {
    const { subtotal, taxAmount, shippingFee, total } = computeInvoiceTotals(
      '100.00',
      8.25,
      15,
    );
    expect(subtotal.toString()).toBe('100');
    expect(taxAmount.toString()).toBe('8.25');
    expect(shippingFee.toString()).toBe('15');
    expect(total.toString()).toBe('123.25');
  });

  it('treats a zero tax rate as tax-exempt', () => {
    const { taxAmount, total } = computeInvoiceTotals('50.00', 0, 0);
    expect(taxAmount.toString()).toBe('0');
    expect(total.toString()).toBe('50');
  });

  it('defaults shipping to zero when omitted', () => {
    const { shippingFee, total } = computeInvoiceTotals('40.00', 10);
    expect(shippingFee.toString()).toBe('0');
    expect(total.toString()).toBe('44');
  });

  it('produces a correct grand total end-to-end from line items', () => {
    const subtotal = sumLineItems([
      { unitPrice: '12.99', quantityOrdered: 3 },
      { unitPrice: '4.50', quantityOrdered: 10 },
    ]);
    const { total } = computeInvoiceTotals(subtotal, 7, 20);
    // subtotal = 38.97 + 45.00 = 83.97; tax = 5.8779; +20 shipping
    expect(subtotal.toString()).toBe('83.97');
    expect(total.toDecimalPlaces(2).toString()).toBe('109.85');
  });

  it('keeps tax on a repeating-decimal subtotal exact before rounding', () => {
    const { taxAmount } = computeInvoiceTotals('19.99', 8.5);
    // 19.99 × 8.5% = 1.69915, held exactly until it is rounded for display.
    expect(taxAmount.toString()).toBe('1.69915');
    expect(taxAmount.toFixed(2)).toBe('1.70');
  });
});
