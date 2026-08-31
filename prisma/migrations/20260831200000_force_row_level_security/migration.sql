-- Paso 3 del checklist (docs/RLS.md): FORCE ROW LEVEL SECURITY en todas las tablas con política
-- activa. Seguro en este punto porque:
--   - El rol que corre las migraciones (DATABASE_URL, "postgres") es SUPERUSUARIO — Postgres
--     exime a los superusuarios de RLS SIEMPRE, con o sin FORCE, así que este mismo script y
--     cualquier tarea de mantenimiento por psql directo siguen funcionando sin cambios.
--   - El rol de runtime de la app (flashstock_app, RUNTIME_DATABASE_URL) NO es dueño de ninguna
--     tabla, así que ya estaba sujeto a estas políticas desde la migración que las creó — FORCE no
--     le cambia nada, es una capa adicional por si algún día un rol dueño-pero-no-superusuario
--     terminara conectándose sin querer.
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoice_counters" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "dispatch_guides" FORCE ROW LEVEL SECURITY;
ALTER TABLE "complaints" FORCE ROW LEVEL SECURITY;
