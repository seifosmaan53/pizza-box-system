import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing all data...');

  // Delete in reverse dependency order
  await prisma.auditLog.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.store.deleteMany();
  await prisma.boxSize.deleteMany();
  await prisma.boxType.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.invoiceCounter.deleteMany();
  await prisma.appSettings.deleteMany();

  console.log('All data cleared.');

  // Create default admin so you can log in
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  await prisma.user.create({
    data: {
      email: 'admin@company.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  console.log('Fresh admin account created.');
  console.log('\nCredentials:');
  console.log('  admin@company.com / Admin123!');
  console.log('\nSystem is ready — add your own data from the app.');
}

main()
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
