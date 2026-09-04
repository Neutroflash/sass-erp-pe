-- Ventas a crédito: clientes del negocio, abonos y cuentas por cobrar.
--
-- Contexto: un negocio que fía entrega la mercadería hoy y cobra después. Eso rompe el supuesto
-- de que "venta cerrada" y "venta cobrada" son el mismo momento, que es lo que `PAID` significaba
-- hasta ahora.

-- ── Estado nuevo ────────────────────────────────────────────────────────────────────────────
-- PENDING_COLLECTION = entregado, con comprobante, sin cobrar.
--
-- NO se reutiliza PENDING_PAYMENT a propósito: el worker de holds (stock-hold-queue.ts) cancela
-- cualquier pedido en ese estado a los 15 minutos y devuelve el stock. Una venta a crédito
-- modelada así se autodestruiría mientras el cliente maneja de vuelta a su tienda.
ALTER TYPE "OrderStatus" ADD VALUE 'PENDING_COLLECTION' BEFORE 'PAID';

CREATE TYPE "PaymentTerm" AS ENUM ('CASH', 'CREDIT');
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'YAPE', 'PLIN', 'TARJETA', 'OTRO');

-- ── Clientes del negocio ────────────────────────────────────────────────────────────────────
-- doc_type/doc_number son nullable a propósito: el alta no los exige porque el negocio no pide
-- documento al fiarle a alguien que conoce. Se llenan al emitir el primer comprobante que los
-- necesite (boleta sobre el umbral, o cualquier factura).
CREATE TABLE "customers" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "address"      TEXT,
  "phone"        TEXT,
  "email"        TEXT,
  "doc_type"     TEXT,
  "doc_number"   TEXT,
  "credit_limit" DECIMAL(10,2),
  "notes"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");
CREATE INDEX "customers_tenant_id_name_idx" ON "customers"("tenant_id", "name");

ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Abonos ──────────────────────────────────────────────────────────────────────────────────
-- Cuelga del CLIENTE, no del pedido: el negocio cobra por persona, no por venta.
CREATE TABLE "payments" (
  "id"            TEXT NOT NULL,
  "tenant_id"     TEXT NOT NULL,
  "customer_id"   TEXT NOT NULL,
  "amount"        DECIMAL(10,2) NOT NULL,
  "method"        "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
  "paid_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note"          TEXT,
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");
CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");

ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Repartición de cada abono entre las ventas abiertas ─────────────────────────────────────
-- Inmutable como el kardex: una repartición no se edita. Corregir un pago mal registrado es
-- anularlo y volver a registrarlo.
CREATE TABLE "payment_allocations" (
  "id"         TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "order_id"   TEXT NOT NULL,
  "amount"     DECIMAL(10,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations"("payment_id");
CREATE INDEX "payment_allocations_order_id_idx" ON "payment_allocations"("order_id");

ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Pedidos ─────────────────────────────────────────────────────────────────────────────────
-- Todo con default: ningún pedido ya cargado cambia de significado. Los existentes quedan en
-- CASH sin cliente asociado, que es exactamente como se comportan hoy.
ALTER TABLE "orders"
  ADD COLUMN "customer_id"  TEXT,
  ADD COLUMN "payment_term" "PaymentTerm" NOT NULL DEFAULT 'CASH',
  ADD COLUMN "due_date"     TIMESTAMP(3);

CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Aislamiento entre negocios (ver docs/RLS.md) ────────────────────────────────────────────
-- Estas tablas guardan quién le debe cuánto a quién. Una consulta sin filtro acá es un negocio
-- viendo la cartera de otro, así que las políticas van en la MISMA migración que las crea, no en
-- una posterior.
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "customers"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payments"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- payment_allocations no tiene tenant_id propio: se aísla vía su pago, igual que order_items vía
-- su pedido.
ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payment_allocations"
  USING (EXISTS (SELECT 1 FROM "payments" p WHERE p.id = "payment_allocations".payment_id AND p.tenant_id = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "payments" p WHERE p.id = "payment_allocations".payment_id AND p.tenant_id = current_setting('app.tenant_id', true)));

ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "payment_allocations" FORCE ROW LEVEL SECURITY;
