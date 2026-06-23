-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "priceCents" INTEGER NOT NULL,
    "costCents" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_product_items" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "productSkuSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_product_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "attendance_product_items_attendanceId_idx" ON "attendance_product_items"("attendanceId");

-- CreateIndex
CREATE INDEX "attendance_product_items_productId_idx" ON "attendance_product_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_product_items_attendanceId_productId_key" ON "attendance_product_items"("attendanceId", "productId");

-- AddForeignKey
ALTER TABLE "attendance_product_items" ADD CONSTRAINT "attendance_product_items_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_product_items" ADD CONSTRAINT "attendance_product_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
