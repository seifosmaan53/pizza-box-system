-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "productStockId" TEXT,
ALTER COLUMN "inventoryItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceLineItem" ALTER COLUMN "description" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "InventoryTransaction_productStockId_idx" ON "InventoryTransaction"("productStockId");

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_productStockId_fkey" FOREIGN KEY ("productStockId") REFERENCES "ProductStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
