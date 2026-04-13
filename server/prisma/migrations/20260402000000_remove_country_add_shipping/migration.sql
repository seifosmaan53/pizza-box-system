-- AlterTable: Remove country from Store, add state/zipCode/defaultShippingFee
ALTER TABLE "Store" DROP COLUMN "country";
ALTER TABLE "Store" ADD COLUMN "state" TEXT;
ALTER TABLE "Store" ADD COLUMN "zipCode" TEXT;
ALTER TABLE "Store" ADD COLUMN "defaultShippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Drop the country index
DROP INDEX IF EXISTS "Store_country_idx";

-- AlterTable: Add shippingFee to Invoice
ALTER TABLE "Invoice" ADD COLUMN "shippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0;
