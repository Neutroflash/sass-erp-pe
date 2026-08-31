-- Row Level Security por tenant — defensa en profundidad además del filtro `tenantId` que ya
-- lleva cada query de la app. Ver docs/RLS.md para el alcance exacto de esta migración: qué
-- código ya fija `app.tenant_id` (checkout/reserva de stock, confirmación/rechazo de pago,
-- emisión de boletas/facturas/notas, venta POS) y qué falta para que esto bloquee algo de verdad
-- en producción (hoy la app se conecta como dueña de las tablas, así que sin FORCE estas
-- políticas son inertes contra esa conexión — a propósito, ver el docs).
--
-- current_setting('app.tenant_id', true) devuelve NULL si nadie lo seteó en la sesión/transacción
-- actual — comparar tenant_id = NULL nunca es verdadero en SQL, así que el default es "deny", no
-- "allow". Nunca se usa FORCE ROW LEVEL SECURITY en esta migración: forzarlo ahora, con solo una
-- parte del código fijando app.tenant_id, rompería en producción cualquier query de un flujo
-- todavía no migrado (panel, reportes, storefront) el día que alguien cambie la conexión a un rol
-- que no sea dueño de las tablas.

-- ── Tablas con tenant_id directo ────────────────────────────────────────────────────────────
ALTER TABLE "platform_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "platform_subscriptions"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "platform_charges" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "platform_charges"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "categories"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "products"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "product_variants"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "stock_movements"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orders"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "invoice_counters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoice_counters"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoices"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE "dispatch_guides" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "dispatch_guides"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- ── Tablas hijas sin tenant_id propio (se aíslan vía el padre) ─────────────────────────────
-- Cubiertas ahora porque son parte directa del flujo de checkout/POS (order_items) y de emisión
-- de comprobantes (invoice_items) — dispatch_guide_items y product_images quedan pendientes
-- (ver docs/RLS.md), no forman parte de los 4 flujos críticos de esta pasada.
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "order_items"
  USING (EXISTS (SELECT 1 FROM "orders" o WHERE o.id = "order_items".order_id AND o.tenant_id = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "orders" o WHERE o.id = "order_items".order_id AND o.tenant_id = current_setting('app.tenant_id', true)));

ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoice_items"
  USING (EXISTS (SELECT 1 FROM "invoices" i WHERE i.id = "invoice_items".invoice_id AND i.tenant_id = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "invoices" i WHERE i.id = "invoice_items".invoice_id AND i.tenant_id = current_setting('app.tenant_id', true)));
