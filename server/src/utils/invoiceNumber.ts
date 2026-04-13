import prisma from '../lib/prisma';

export async function generateInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = process.env.INVOICE_PREFIX || 'INV';

  const result = await prisma.$transaction(async (tx) => {
    const counter = await tx.invoiceCounter.findUnique({
      where: { id: 'counter' },
    });

    let nextSeq: number;

    if (!counter || counter.year !== currentYear) {
      // Reset for new year or create fresh
      await tx.invoiceCounter.upsert({
        where: { id: 'counter' },
        update: { year: currentYear, lastSeq: 1 },
        create: { id: 'counter', year: currentYear, lastSeq: 1 },
      });
      nextSeq = 1;
    } else {
      nextSeq = counter.lastSeq + 1;
      await tx.invoiceCounter.update({
        where: { id: 'counter' },
        data: { lastSeq: nextSeq },
      });
    }

    return nextSeq;
  });

  const paddedSeq = String(result).padStart(5, '0');
  return `${prefix}-${currentYear}-${paddedSeq}`;
}

export async function peekNextInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = process.env.INVOICE_PREFIX || 'INV';

  const counter = await prisma.invoiceCounter.findUnique({
    where: { id: 'counter' },
  });

  let nextSeq: number;

  if (!counter || counter.year !== currentYear) {
    nextSeq = 1;
  } else {
    nextSeq = counter.lastSeq + 1;
  }

  const paddedSeq = String(nextSeq).padStart(5, '0');
  return `${prefix}-${currentYear}-${paddedSeq}`;
}
