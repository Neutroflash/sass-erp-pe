# Row Level Security (RLS) — estado real

Defensa en profundidad para el aislamiento multi-tenant, además del filtro `tenantId` que ya
lleva cada query de la app. **Los 4 pasos del checklist están completos y verificados** —
migraciones `20260831030000_add_row_level_security`, `20260831180000_rls_exclude_platform_billing`
y `20260831200000_force_row_level_security`.

## Qué existe hoy

- **Políticas RLS activas y FORZADAS** en 10 tablas con `tenant_id` directo (`users`,
  `categories`, `products`, `product_variants`, `stock_movements`, `orders`, `invoices`,
  `invoice_counters`, `dispatch_guides`, `complaints`) + 2 tablas hijas sin `tenant_id` propio,
  aisladas vía `EXISTS` contra su padre (`order_items` → `orders`, `invoice_items` → `invoices`).
- Cada política: `USING`/`WITH CHECK` contra `current_setting('app.tenant_id', true)`. Sin ese
  valor seteado en la sesión, la política deniega — no hay fallback "permitir todo".
- **`platform_subscriptions`/`platform_charges` quedan fuera del alcance a propósito** — son el
  libro de cobros de FlashStock hacia sus tenants (no datos de un negocio hacia SU cliente), y dos
  superficies legítimas necesitan cruzar TODOS los tenants a la vez sin ningún "tenant actual":
  `/admin/(protected)/subscriptions` (SuperAdmin) y `domain/platform-billing/billing-cycle.ts`
  (worker diario).
- **Rol de runtime separado** (`flashstock_app`, creado por `scripts/setup-app-role.sh`): no es
  dueño de ninguna tabla, así que queda sujeto a las políticas sin necesitar `FORCE` — `FORCE` se
  aplicó igual, como defensa adicional por si algún día un rol dueño-pero-no-superusuario se
  conecta sin querer. El rol de migraciones (`DATABASE_URL`) sigue siendo superusuario — Postgres
  exime a los superusuarios de RLS siempre, con o sin `FORCE`, así que `prisma migrate`/scripts de
  mantenimiento no cambian.
- **`src/lib/prisma.ts`** decide qué rol usa el Prisma Client de runtime: `RUNTIME_DATABASE_URL`
  si existe (rol `flashstock_app`), si no cae a `DATABASE_URL`. Es el único punto del repo que
  decide esto.
- **Helper** `src/lib/tenant-rls.ts`: `setTenantForTransaction(tx, tenantId)` (para código que ya
  abre su propia transacción) y `withTenantRLS(prisma, tenantId, fn)` (para una operación
  aislada). Wireado en **todas** las queries de la app contra las tablas de arriba — no solo los 4
  flujos originales (checkout, pagos, facturación, POS), sino también panel completo (inventario,
  kardex, pedidos, reportes, facturación, configuración, reclamos, POS), storefront completo
  (home, catálogo, producto, confirmación de pedido), auth (login, forgot/reset password,
  verificación de email) y el resto de rutas API (categorías, productos, variantes, movimientos
  de stock, guías de remisión).
- `getCurrentTenantUser()` ahora pide `tenantId` como parámetro y lo suma al `WHERE` de su propia
  query — antes solo buscaba por el `sub` del JWT y confiaba en que cada caller comparara
  `user.tenantId` después.

## Bootstrap queries — sin envolver, a propósito

Un puñado de queries no pueden fijar `app.tenant_id` porque son justamente las que DESCUBREN a
qué tenant pertenece algo, antes de que exista ningún tenant conocido en el contexto:

- `getCurrentTenant()` (`tenant.findUnique` por slug) — el origen de todo lo demás.
- `src/worker.ts` (job de stock-hold): `order.findUnique` por `orderId` solo.
- `domain/dispatch-guides/resolve-ticket.ts`: `dispatchGuide.findUnique` por id solo.
- `domain/invoicing/sunat/retry.ts`: `invoice.findUnique` por id solo.

En los tres últimos, la query que sigue inmediatamente después (una vez resuelto `tenantId`) SÍ
está envuelta.

## Verificación real (no solo "compila")

**Contra un rol sin privilegios** (`app_rls_test` primero, luego el propio `flashstock_app` ya en
uso real — ambos creados y probados en esta sesión):
1. Sin `app.tenant_id` seteado → `0` filas visibles, aunque existan filas reales.
2. Con `app.tenant_id` = tenant A → solo se ven filas de A, nunca de B.
3. Con `app.tenant_id` = tenant B → solo se ven filas de B, nunca de A.
4. `INSERT` con `tenant_id` distinto al de la sesión → rechazado por `WITH CHECK`.
5. La política indirecta (`order_items` vía `EXISTS`) se comporta igual que las directas.
6. Tras `FORCE`: el rol dueño/superusuario (`postgres`) sigue viendo todo sin restricción (exento
   por ser superusuario); `flashstock_app` sigue bloqueado sin tenant seteado.

**Contra la app real, con `RUNTIME_DATABASE_URL` apuntando a `flashstock_app` (RLS realmente
activo, no simulado)**:
- Storefront completo (home/catálogo/producto) de dos tenants distintos (`piloto-01`, con
  productos reales; `negocio-b`, sin productos) — cada uno ve exactamente lo suyo.
- Login + panel completo (dashboard, inventario, kardex, pedidos, reportes, facturación,
  configuración, reclamos, POS) — todas las páginas devuelven datos reales, ninguna vacía por
  error de RLS.
- Checkout de punta a punta: crear pedido (reservedStock sube) → confirmar pago vía
  `/api/orders/[id]/confirm-payment` (stock baja, reservedStock vuelve a 0, orden `PAID`).
- Libro de Reclamaciones: envío público → folio → visible en `/panel/reclamos`.

## Checklist — completo

1. ~~Crear un rol de Postgres que no sea dueño de las tablas.~~ `flashstock_app`,
   `scripts/setup-app-role.sh`.
2. ~~Extender `set_config('app.tenant_id', ...)` a todas las queries de los modelos con política
   activa.~~ Hecho — ver arriba.
3. ~~`FORCE ROW LEVEL SECURITY` tabla por tabla.~~ Migración `20260831200000_force_row_level_security`.
4. ~~Reverificar contra el rol real.~~ Ver "Verificación real" arriba.

## Pendiente real (fuera de alcance de esta pasada)

- `product_images` y `dispatch_guide_items` (sin `tenant_id` propio) no tienen política todavía —
  no forman parte de los 4 flujos críticos originales ni de las superficies de mayor riesgo.
- En producción: correr `scripts/setup-app-role.sh` contra la base real, y setear
  `RUNTIME_DATABASE_URL` en las variables de entorno del hosting — sin eso, la app en producción
  sigue conectándose con el rol dueño (igual que hoy, sin protección adicional de RLS) hasta que
  se haga ese paso manual.
