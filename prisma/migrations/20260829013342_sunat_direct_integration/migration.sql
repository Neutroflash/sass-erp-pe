-- CreateEnum
CREATE TYPE "SunatEnvironment" AS ENUM ('BETA', 'PRODUCCION');

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PENDING_SUNAT';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "signed_xml" TEXT,
ADD COLUMN     "sunat_retry_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "sunat_certificate_enc" BYTEA,
ADD COLUMN     "sunat_certificate_password_enc" BYTEA,
ADD COLUMN     "sunat_environment" "SunatEnvironment" NOT NULL DEFAULT 'BETA',
ADD COLUMN     "sunat_sol_password_enc" BYTEA,
ADD COLUMN     "sunat_sol_user" TEXT;
