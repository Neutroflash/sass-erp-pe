-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "izipay_hmac_key_enc" BYTEA,
ADD COLUMN     "izipay_password_enc" BYTEA,
ADD COLUMN     "izipay_public_key" TEXT,
ADD COLUMN     "izipay_username" TEXT;
