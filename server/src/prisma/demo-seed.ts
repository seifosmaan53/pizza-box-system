import dotenv from 'dotenv';
import { PrismaClient, InvoiceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Same reason as reset.ts: Prisma resolves DATABASE_URL when the client is
// constructed, and this is a separate entrypoint from server.ts.
dotenv.config();

const prisma = new PrismaClient();

/*
 * Demo data for screenshots, local exploration, and manual QA.
 *
 * `prisma:reset` deliberately leaves an empty system with one admin — that is the
 * right starting point for a real deployment. It is the wrong one for looking at
 * the app, because every analytics query filters on
 * `status IN (PAID, SENT, OVERDUE)` and a date window (see controllers/analytics.ts).
 * A database of DRAFT invoices therefore renders every chart empty and every
 * revenue figure as 0, which reads as a broken app rather than an empty one.
 *
 * So the invoices below are spread across statuses AND across the last ~120 days,
 * which is what makes the 7d/30d/90d/12m range selector show different things.
 *
 * Deterministic on purpose: a fixed seed means re-running produces the same
 * numbers, so a screenshot can be retaken later without silently changing them.
 */

// Mulberry32 — small deterministic PRNG. Any fixed-seed generator would do; the
// point is only that `npm run demo:seed` twice gives the same database twice.
function makeRng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260907);
const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const money = (n: number) => Math.round(n * 100) / 100;

const STORES = [
  { name: 'Downtown Slice Co.',    contactName: 'Marco Ferretti',  email: 'orders@downtownslice.com',   phone: '(212) 555-0148', address: '412 Bleecker St',     city: 'New York',     state: 'NY', zipCode: '10014', taxRate: 8.875, defaultShippingFee: 25 },
  { name: 'Riverside Slice House', contactName: 'Dana Whitlock',   email: 'purchasing@riversidesh.com', phone: '(718) 555-0193', address: '88 Kent Ave',         city: 'Brooklyn',     state: 'NY', zipCode: '11249', taxRate: 8.875, defaultShippingFee: 25 },
  { name: 'Uptown Brick Oven',     contactName: 'Priya Raghavan',  email: 'ap@uptownbrickoven.com',     phone: '(917) 555-0122', address: '2301 Broadway',       city: 'New York',     state: 'NY', zipCode: '10024', taxRate: 8.875, defaultShippingFee: 30 },
  { name: 'Harbor Pie Works',      contactName: 'Tomas Oyelaran',  email: 'tomas@harborpieworks.com',   phone: '(203) 555-0177', address: '19 Water St',         city: 'Stamford',     state: 'CT', zipCode: '06902', taxRate: 6.35,  defaultShippingFee: 40 },
  { name: 'Garden State Pizzeria', contactName: 'Alicia Moreno',   email: 'alicia@gspizzeria.com',      phone: '(973) 555-0165', address: '640 Bloomfield Ave',  city: 'Montclair',    state: 'NJ', zipCode: '07042', taxRate: 6.625, defaultShippingFee: 35 },
];

const BOX_TYPES = [
  { name: 'Corrugated Kraft',   description: 'Standard B-flute corrugated, unprinted kraft exterior' },
  { name: 'Clay-Coated White',  description: 'Clay-coated news back, takes full-colour print' },
  { name: 'Recycled Brown',     description: '100% post-consumer recycled, FSC certified' },
  { name: 'Grease-Resistant',   description: 'PFAS-free grease barrier liner for high-oil pies' },
  { name: 'Ventilated Premium', description: 'Perforated side vents to reduce crust sogginess' },
];

const BOX_SIZES = [
  { name: '10 inch', dimensions: '10 x 10 x 1.75 in', sortOrder: 1 },
  { name: '12 inch', dimensions: '12 x 12 x 1.75 in', sortOrder: 2 },
  { name: '14 inch', dimensions: '14 x 14 x 2 in',    sortOrder: 3 },
  { name: '16 inch', dimensions: '16 x 16 x 2 in',    sortOrder: 4 },
  { name: '18 inch', dimensions: '18 x 18 x 2 in',    sortOrder: 5 },
];

// Larger boxes cost more; this keeps unit prices plausible rather than random.
const PRICE_BY_SIZE: Record<string, number> = {
  '10 inch': 0.42, '12 inch': 0.51, '14 inch': 0.63, '16 inch': 0.78, '18 inch': 0.94,
};
const PRICE_MULTIPLIER_BY_TYPE: Record<string, number> = {
  'Corrugated Kraft': 1.0, 'Clay-Coated White': 1.25, 'Recycled Brown': 1.1,
  'Grease-Resistant': 1.4, 'Ventilated Premium': 1.6,
};

async function main() {
  console.log('Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.productStock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.store.deleteMany();
  await prisma.boxSize.deleteMany();
  await prisma.boxType.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.invoiceCounter.deleteMany();
  await prisma.appSettings.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@company.com',
      passwordHash: await bcrypt.hash('Admin123!', 10),
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  const boxTypes = await Promise.all(BOX_TYPES.map((data) => prisma.boxType.create({ data })));
  const boxSizes = await Promise.all(BOX_SIZES.map((data) => prisma.boxSize.create({ data })));
  const stores = await Promise.all(STORES.map((data) => prisma.store.create({ data })));
  console.log(`Created ${stores.length} stores, ${boxTypes.length} box types, ${boxSizes.length} sizes.`);

  // Every store stocks every size, but only three of the five types, so the
  // inventory list has variety instead of a uniform grid.
  const inventory: { id: string; storeId: string; type: string; size: string; price: number; quantity: number }[] = [];
  for (const store of stores) {
    const stocked = [...boxTypes].sort(() => rng() - 0.5).slice(0, 3);
    for (const type of stocked) {
      for (const size of boxSizes) {
        const price = money(PRICE_BY_SIZE[size.name] * PRICE_MULTIPLIER_BY_TYPE[type.name]);
        // A handful land under the threshold so the low-stock panel is populated
        // rather than empty — that panel is a real feature and should be visible.
        const quantity = rng() < 0.12 ? between(2, 18) : between(120, 1400);
        const item = await prisma.inventoryItem.create({
          data: {
            storeId: store.id, boxTypeId: type.id, boxSizeId: size.id,
            quantity, pricePerUnit: price, lowStockThreshold: 25,
          },
        });
        inventory.push({ id: item.id, storeId: store.id, type: type.name, size: size.name, price, quantity });
      }
    }
  }
  console.log(`Created ${inventory.length} inventory items.`);

  /*
   * Status mix is chosen so each dashboard widget has something to show:
   * PAID dominates (it is the normal end state), a few are still SENT and
   * therefore outstanding, three are OVERDUE so the overdue KPI is non-zero,
   * and a couple stay DRAFT so that state is represented too.
   */
  const PLAN: { status: InvoiceStatus; count: number }[] = [
    { status: 'PAID', count: 26 },
    { status: 'SENT', count: 7 },
    { status: 'OVERDUE', count: 3 },
    { status: 'DRAFT', count: 2 },
  ];

  let seq = 0;
  let created = 0;
  for (const { status, count } of PLAN) {
    for (let i = 0; i < count; i++) {
      const store = pick(stores);
      const options = inventory.filter((x) => x.storeId === store.id);

      // OVERDUE has to be genuinely old, or a due date in the future would
      // contradict the status the row claims.
      const issuedDaysAgo = status === 'OVERDUE' ? between(75, 115) : between(1, 118);
      const issueDate = daysAgo(issuedDaysAgo);
      const dueDate = new Date(issueDate.getTime() + 30 * 86_400_000);

      const lines = [...options].sort(() => rng() - 0.5).slice(0, between(2, 4));
      const lineData = lines.map((line) => {
        const quantityOrdered = between(4, 40) * 25; // ordered by the case
        const lineTotal = money(line.price * quantityOrdered);
        return {
          inventoryItemId: line.id,
          description: `${line.type} — ${line.size}`,
          boxTypeSnapshot: line.type,
          boxSizeSnapshot: line.size,
          quantityOrdered,
          unitPrice: line.price,
          lineTotal,
        };
      });

      const subtotal = money(lineData.reduce((sum, l) => sum + l.lineTotal, 0));
      const taxAmount = money(subtotal * (store.taxRate / 100));
      const shippingFee = money(Number(store.defaultShippingFee));
      const total = money(subtotal + taxAmount + shippingFee);

      seq += 1;
      await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-2026-${String(seq).padStart(5, '0')}`,
          storeId: store.id,
          status,
          issueDate,
          dueDate,
          sentAt: status === 'DRAFT' ? null : issueDate,
          paidAt: status === 'PAID' ? new Date(issueDate.getTime() + between(2, 25) * 86_400_000) : null,
          overdueAt: status === 'OVERDUE' ? dueDate : null,
          currency: 'USD',
          taxRate: store.taxRate,
          subtotal, taxAmount, shippingFee, total,
          createdById: admin.id,
          lineItems: { create: lineData },
        },
      });
      created += 1;
    }
  }

  // Keep the counter ahead of what was just inserted, so the first invoice
  // created through the UI does not collide with a seeded invoice number.
  await prisma.invoiceCounter.create({ data: { year: 2026, lastSeq: seq } });

  const paid = await prisma.invoice.aggregate({ _sum: { total: true }, where: { status: 'PAID' } });
  console.log(`Created ${created} invoices across ${PLAN.length} statuses.`);
  console.log(`Paid revenue on the books: $${Number(paid._sum.total ?? 0).toFixed(2)}`);
  console.log('\nSign in with:  admin@company.com / Admin123!');
}

main()
  .catch((e) => {
    console.error('Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
