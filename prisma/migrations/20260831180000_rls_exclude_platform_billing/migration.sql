-- platform_subscriptions/platform_charges quedan FUERA del alcance de RLS por tenant, a
-- diferencia del resto de tablas en 20260831030000_add_row_level_security. No son datos de un
-- negocio hacia SU cliente — son el propio libro de cobros de FlashStock hacia sus tenants, y dos
-- superficies legítimas necesitan leerlas cruzando TODOS los tenants a la vez, sin ningún
-- "tenant actual" que fijar:
--   - /admin/(protected)/subscriptions (SuperAdmin, lista todas las suscripciones)
--   - domain/platform-billing/billing-cycle.ts (worker diario, escanea todas las vencidas)
-- El filtro tenantId de siempre en el resto de queries (ej. un tenant viendo SU plan en
-- Configuración) sigue aplicando igual — esto solo quita la capa extra de RLS para estas 2 tablas.
ALTER TABLE "platform_subscriptions" DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "platform_subscriptions";

ALTER TABLE "platform_charges" DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "platform_charges";
