/*
  Warnings:

  - Added the required column `description` to the `InvoiceLineItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "InvoiceLineItem_invoiceId_inventoryItemId_key";

-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "productId" TEXT,
ALTER COLUMN "inventoryItemId" DROP NOT NULL;

-- Backfill description from snapshots
UPDATE "InvoiceLineItem" SET "description" = "boxTypeSnapshot" || ' ' || "boxSizeSnapshot" WHERE "description" = '';

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "category" TEXT,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX "Product_sku_idx" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "ProductStock_productId_idx" ON "ProductStock"("productId");

-- CreateIndex
CREATE INDEX "ProductStock_storeId_idx" ON "ProductStock"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStock_productId_storeId_key" ON "ProductStock"("productId", "storeId");

-- CreateIndex
CREATE INDEX "InvoiceLineItem_productId_idx" ON "InvoiceLineItem"("productId");

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
