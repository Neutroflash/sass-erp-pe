-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN     "password_reset_token_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_token_hash" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_reset_token_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_token_hash" TEXT;
