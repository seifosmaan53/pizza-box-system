-- AlterTable: Add sentAt, cancelledAt, overdueAt to Invoice
ALTER TABLE "Invoice" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "overdueAt" TIMESTAMP(3);

-- AlterTable: Add company details to AppSettings
ALTER TABLE "AppSettings" ADD COLUMN "companyAddress" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "companyEmail" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "companyPhone" TEXT;
