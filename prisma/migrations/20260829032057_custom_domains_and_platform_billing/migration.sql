-- CreateEnum
CREATE TYPE "PlatformSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlatformChargeStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "custom_domain_pending" TEXT,
ADD COLUMN     "custom_domain_verification_token" TEXT,
ADD COLUMN     "custom_domain_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "platform_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" "PlatformSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_charges" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan_tier" "PlanTier" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" "PlatformChargeStatus" NOT NULL DEFAULT 'PENDING',
    "provider_charge_id" TEXT,
    "provider_response" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_subscriptions_tenant_id_key" ON "platform_subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "platform_charges_tenant_id_idx" ON "platform_charges"("tenant_id");

-- CreateIndex
CREATE INDEX "platform_charges_subscription_id_idx" ON "platform_charges"("subscription_id");

-- AddForeignKey
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_charges" ADD CONSTRAINT "platform_charges_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "platform_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
