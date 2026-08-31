import { buildDiff } from '../utils/auditLog';

/**
 * buildDiff produces the payload stored in the audit trail, so what it reports is what
 * anyone later investigating a change will see. It had no tests. The cases below pin
 * the behaviour that matters — including one genuinely surprising property (see the
 * last block) that is worth knowing about before trusting a diff.
 */
describe('buildDiff', () => {
  it('reports nothing when nothing changed', () => {
    expect(buildDiff({ name: 'Box', price: 10 }, { name: 'Box', price: 10 })).toEqual({});
  });

  it('reports only the fields that actually changed', () => {
    const diff = buildDiff(
      { name: 'Box', price: 10, sku: 'B-1' },
      { name: 'Box', price: 12, sku: 'B-1' },
    );

    expect(diff).toEqual({ price: { before: 10, after: 12 } });
    expect(Object.keys(diff)).toHaveLength(1);
  });

  it('reports an added field, with before undefined', () => {
    expect(buildDiff({ name: 'Box' }, { name: 'Box', note: 'fragile' })).toEqual({
      note: { before: undefined, after: 'fragile' },
    });
  });

  it('reports a removed field, with after undefined', () => {
    expect(buildDiff({ name: 'Box', note: 'fragile' }, { name: 'Box' })).toEqual({
      note: { before: 'fragile', after: undefined },
    });
  });

  it('treats null and undefined as distinct from a value', () => {
    expect(buildDiff({ note: null }, { note: 'set' })).toEqual({
      note: { before: null, after: 'set' },
    });
  });

  it('compares nested objects and arrays by value, not by reference', () => {
    const unchanged = buildDiff(
      { sizes: [1, 2, 3], meta: { a: 1 } },
      { sizes: [1, 2, 3], meta: { a: 1 } },
    );
    expect(unchanged).toEqual({});

    const changed = buildDiff({ sizes: [1, 2, 3] }, { sizes: [1, 2, 4] });
    expect(changed.sizes).toEqual({ before: [1, 2, 3], after: [1, 2, 4] });
  });

  it('does not confuse the number 10 with the string "10"', () => {
    // JSON.stringify(10) is "10" and JSON.stringify('10') is "\"10\"", so these differ.
    // Worth pinning: a Prisma Decimal arriving as a string instead of a number would
    // otherwise show up as a phantom edit in the audit trail.
    expect(buildDiff({ price: 10 }, { price: '10' })).toEqual({
      price: { before: 10, after: '10' },
    });
  });

  it('KNOWN LIMITATION: key order inside a nested object counts as a change', () => {
    /* Comparison is JSON.stringify-based, which is order-sensitive for object keys.
       Two nested objects holding identical data in a different insertion order are
       reported as changed. Harmless for Prisma rows, whose key order is stable — but
       do not reuse buildDiff on payloads assembled by hand or parsed from arbitrary
       JSON without knowing this. */
    const diff = buildDiff({ meta: { a: 1, b: 2 } }, { meta: { b: 2, a: 1 } });

    expect(diff.meta).toBeDefined();
  });
});
