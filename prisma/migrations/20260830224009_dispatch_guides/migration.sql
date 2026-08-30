-- CreateEnum
CREATE TYPE "DispatchGuideStatus" AS ENUM ('PENDING_SUNAT', 'ISSUED', 'FAILED');

-- AlterEnum
ALTER TYPE "InvoiceType" ADD VALUE 'GUIA_REMISION';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "sunat_gre_client_id" TEXT,
ADD COLUMN     "sunat_gre_client_secret_enc" BYTEA;

-- CreateTable
CREATE TABLE "dispatch_guides" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT,
    "series" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "DispatchGuideStatus" NOT NULL DEFAULT 'PENDING_SUNAT',
    "transfer_reason_code" TEXT NOT NULL,
    "transfer_date" TIMESTAMP(3) NOT NULL,
    "gross_weight_kg" DECIMAL(10,3) NOT NULL,
    "origin_ubigeo" TEXT NOT NULL,
    "origin_address" TEXT NOT NULL,
    "destination_ubigeo" TEXT NOT NULL,
    "destination_address" TEXT NOT NULL,
    "recipient_doc_type" TEXT NOT NULL,
    "recipient_doc_number" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "vehicle_plate" TEXT NOT NULL,
    "driver_doc_number" TEXT NOT NULL,
    "driver_first_name" TEXT NOT NULL,
    "driver_last_name" TEXT NOT NULL,
    "driver_license" TEXT NOT NULL,
    "num_ticket" TEXT,
    "sunat_response_code" TEXT,
    "sunat_description" TEXT,
    "signed_xml" TEXT,
    "issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_guide_items" (
    "id" TEXT NOT NULL,
    "dispatch_guide_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_code" TEXT NOT NULL DEFAULT 'NIU',

    CONSTRAINT "dispatch_guide_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_guides_order_id_key" ON "dispatch_guides"("order_id");

-- CreateIndex
CREATE INDEX "dispatch_guides_tenant_id_idx" ON "dispatch_guides"("tenant_id");

-- AddForeignKey
ALTER TABLE "dispatch_guides" ADD CONSTRAINT "dispatch_guides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_guides" ADD CONSTRAINT "dispatch_guides_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_guide_items" ADD CONSTRAINT "dispatch_guide_items_dispatch_guide_id_fkey" FOREIGN KEY ("dispatch_guide_id") REFERENCES "dispatch_guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_guide_items" ADD CONSTRAINT "dispatch_guide_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
