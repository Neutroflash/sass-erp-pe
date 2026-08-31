# Row Level Security (RLS) — estado real

Defensa en profundidad para el aislamiento multi-tenant, además del filtro `tenantId` que ya
lleva cada query de la app (`prisma/migrations/20260831030000_add_row_level_security`).

## Qué existe hoy

- **Políticas RLS activas** en Postgres sobre 11 tablas con `tenant_id` directo (`users`,
  `categories`, `products`, `product_variants`, `stock_movements`, `orders`, `invoices`,
  `invoice_counters`, `dispatch_guides`, `platform_subscriptions`, `platform_charges`) + 2 tablas
  hijas sin `tenant_id` propio, aisladas vía `EXISTS` contra su padre (`order_items` → `orders`,
  `invoice_items` → `invoices`).
- Cada política: `USING`/`WITH CHECK` contra `current_setting('app.tenant_id', true)`. Sin ese
  valor seteado en la sesión, la política deniega — no hay fallback "permitir todo".
- **Helper** `src/lib/tenant-rls.ts`: `setTenantForTransaction(tx, tenantId)` (para código que ya
  abre su propia transacción) y `withTenantRLS(prisma, tenantId, fn)` (para una operación aislada,
  abre una mini-transacción de 2 statements en la misma conexión — necesario por el pool de
  Prisma).
- **Wireado en los 4 flujos que el usuario priorizó** (los de mayor riesgo real: dinero e
  inventario):
  - Reserva de stock / checkout — `domain/orders/reserve-stock.ts` (cubre también POS, que
    reusa la misma función).
  - Confirmación/rechazo de pago — `domain/orders/resolve-order.ts` (`markOrderPaid`,
    `releaseOrderHold`), y sus 4 call sites (webhook Izipay, confirm-payment, reject-payment,
    worker de expiración del hold).
  - Emisión de boletas/facturas/notas — `domain/invoicing/issue-invoice.ts`, `issue-note.ts`,
    `counter.ts` (correlativos), `tenant-invoicing-info.ts` (chequeo de límite del plan).

## Qué NO está cubierto todavía

- El resto de queries del repo (panel: inventario, kardex, pedidos, reportes; storefront:
  catálogo, producto) siguen protegidas **solo** por el filtro `tenantId` de siempre — sin el
  respaldo de RLS. No es un descuido: extenderlo a esas rutas es un cambio mecánico pero de
  decenas de archivos, fuera del alcance que se acordó para esta pasada.
- `product_images` y `dispatch_guide_items` (también sin `tenant_id` propio) no tienen política
  todavía — no forman parte de los 4 flujos críticos.

## Por qué las políticas NO bloquean nada hoy en la app real (a propósito)

La app se conecta a Postgres como el **dueño** de las tablas (`postgres`, ver `DATABASE_URL`).
Postgres exime al dueño de una tabla de sus propias políticas RLS **a menos que** se use
`FORCE ROW LEVEL SECURITY` — que esta migración **no** activa, a propósito: forzarlo ahora, con
solo 4 flujos fijando `app.tenant_id`, rompería en producción cualquier query de un flujo todavía
no migrado (devolvería 0 filas / rechazaría escrituras) el día que alguien cambie la conexión a un
rol que no sea dueño.

## Verificación real (no solo "corre sin errores")

Se probó contra un rol de Postgres **sin privilegios de superusuario ni de dueño**
(`app_rls_test`, creado y borrado en esta sesión, no queda en la base), confirmando:

1. Sin `app.tenant_id` seteado → `0` filas visibles, aunque existan filas reales.
2. Con `app.tenant_id` = tenant A → solo se ven filas de A, nunca de B.
3. Con `app.tenant_id` = tenant B → solo se ven filas de B, nunca de A.
4. `INSERT` con `tenant_id` distinto al `app.tenant_id` de la sesión → rechazado por `WITH CHECK`.
5. La política indirecta (`order_items` vía `EXISTS` sobre `orders`) se comporta igual que las
   directas.

Y contra la app real (conectada como dueña, por ende sin bloqueo aún): un pedido completo de
checkout → confirmación de pago, verificando que `reservedStock`/`stock`/`status` terminan
correctos — confirma que agregar `set_config()` no rompió el flujo transaccional existente.

## Checklist para que esto bloquee algo de verdad en producción

1. Crear un rol de Postgres para la app que **no** sea dueño de las tablas (separar
   rol-de-migraciones de rol-de-runtime — patrón estándar, no específico de este proyecto).
2. Extender `set_config('app.tenant_id', ...)` a TODAS las queries de los modelos con política
   activa (panel, reportes, storefront) — no solo los 4 flujos de hoy.
3. Recién entonces `ALTER TABLE ... FORCE ROW LEVEL SECURITY` en cada tabla, una por una, tras
   confirmar que ningún código pendiente la toca sin el helper.
4. Repetir la verificación de este documento (rol sin privilegios, prueba positiva/negativa) contra
   el rol de producción real antes de considerarlo activado.
