-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('RECLAMO', 'QUEJA');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'RESOLVED');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "complaint_counter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "privacy_policy" TEXT,
ADD COLUMN     "terms_and_conditions" TEXT;

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "type" "ComplaintType" NOT NULL,
    "consumer_name" TEXT NOT NULL,
    "consumer_doc_type" TEXT NOT NULL,
    "consumer_doc_number" TEXT NOT NULL,
    "consumer_address" TEXT NOT NULL,
    "consumer_phone" TEXT,
    "consumer_email" TEXT NOT NULL,
    "product_description" TEXT NOT NULL,
    "claimed_amount" DECIMAL(10,2),
    "purchase_date" TIMESTAMP(3),
    "detail" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complaints_tenant_id_idx" ON "complaints"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_tenant_id_folio_key" ON "complaints"("tenant_id", "folio");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (ver docs/RLS.md) — complaints contiene PII sensible del consumidor (DNI, dirección,
-- teléfono), mismo criterio de "riesgo real" que los 4 flujos ya cubiertos por
-- 20260831030000_add_row_level_security. Tabla nueva, sin callers legacy que romper: se agrega
-- la política de una vez junto con el modelo, no como retrofit posterior.
ALTER TABLE "complaints" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "complaints"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
