# Roadmap

Orden pensado para nunca quedar con un sistema a medias (cada fase cierra un flujo completo, usable). No es una estimación de tiempo — es una secuencia de dependencias reales: no tiene sentido facturar (Fase 3) antes de poder vender (Fase 2), ni vender antes de que un negocio pueda registrarse y configurar su tienda (Fase 1).

## Fase 0 — Fundamentos (hecho en este scaffold)

- Estructura de carpetas, `schema.prisma` completo, `middleware.ts` de resolución de tenant por subdominio, `lib/prisma.ts`, `lib/tenant-context.ts`.
- Dos páginas de punta a punta como prueba de que el patrón funciona (`/admin/tenants`, `/sites/[tenant]`) — build y typecheck verificados.
- **No hecho todavía, y a propósito**: nada de autenticación, nada de UI real, nada de lógica de negocio. Es el esqueleto, no el producto.

## Fase 1 — Plataforma, onboarding y feature flags ✅ (completa, verificado en vivo)

Objetivo: un negocio puede registrarse solo y llegar a un panel vacío pero suyo, protegido — y ese panel muestra solo los módulos que ese negocio tiene contratados.

1. ✅ Auth de `User` dentro de un tenant — JWT access+refresh, bcrypt, cookies httpOnly `sameSite: strict` **host-only** (sin `domain` explícito), a propósito: eso es lo que hace que la sesión de un negocio jamás viaje a otro aunque compartan `tusaas.pe`, verificado en vivo (ver más abajo). El mismo email puede repetirse *entre* tenants distintos — la unicidad es `(tenantId, email)`, nunca `email` a secas.
2. ✅ `POST /api/tenants` (dominio raíz) + formulario en `/registro`: crea `Tenant` + su primer `User` (`OWNER`) en una transacción, con `features` en el default (`DEFAULT_TENANT_FEATURES`). Verificado en vivo de punta a punta: registro → login del nuevo OWNER → aparece en el listado del SuperAdmin.
3. ✅ Guard de acceso en `/sites/[tenant]/panel/**` (`panel/layout.tsx`): sesión válida, **del mismo tenant** que la URL, rol `OWNER`/`SELLER` (nunca `CUSTOMER`). Verificado en vivo con varios negocios distintos.
4. ✅ **Feature flags** (`Tenant.features`, `src/domain/tenant-features.ts`, `src/lib/features.ts`, `src/lib/feature-guards.ts`): `hasFeature()`, guard de página (`requireFeature`, redirige) y de Route Handler (`assertFeatureOrRespond403`, 403 real), `Sidebar` que solo renderiza los módulos activos, dashboard con tarjetas condicionadas. Seed del Cliente Piloto. Todo verificado en vivo — login, dashboard con las 4 tarjetas correctas, `/panel/facturacion` redirigiendo por tener `sunatInvoicing: false`, y el link correspondiente ausente del Sidebar.
5. ✅ Auth de `PlatformAdmin`: `/admin/ingresar` (fuera del grupo protegido, mismo criterio que `/sites/[tenant]/ingresar`), `/admin/(protected)/layout.tsx` como guard de todo `admin.tusaas.pe/**` autenticado, `/admin/(protected)/tenants` restyleado. `PlatformAdmin` sembrado (`admin@tusaas.pe` / `SuperAdmin123!`, ver `prisma/seed.ts`). Verificado en vivo: acceso sin sesión redirige a `/ingresar`, con sesión lista los negocios.
6. ✅ `/sites/[tenant]/panel/configuracion` (`SettingsForm.tsx`, `PATCH /api/settings`): edita razón social/RUC/dirección fiscal/logo/color primario y los 5 módulos (`features`) con checkboxes — el PATCH mergea el parche sobre las features existentes, nunca las reemplaza enteras. **OWNER-only** (`requireTenantOwner()`, nuevo en `api-guards.ts`): un SELLER que visite la página es redirigido a `/panel`, y el PATCH le devuelve 401 — verificado en vivo con ambos roles.

**Punto delicado de esta fase, ya resuelto y confirmado en vivo, no solo razonado**: el aislamiento entre tenants no depende únicamente del chequeo `user.tenantId !== tenant.id` en el guard — la cookie de sesión de un negocio, al ser host-only, ni siquiera *llega* al servidor en una request hacia el subdominio de otro negocio. El chequeo de código es la segunda capa, no la única.

## Fase 2 — Inventario, catálogo y ventas online ✅ (hecho, verificado en vivo)

Objetivo: un negocio carga productos y un cliente final le compra en línea.

1. ✅ CRUD de `Category`/`Product`/`ProductVariant`/`ProductImage`, scoped por `tenantId` (slug y SKU únicos *por tenant*, no globalmente). Panel de inventario (`InventoryTable`, `CreateProductForm`) adaptado del patrón de Flashkings. Verificado en vivo: creación de producto con variantes vía API.
2. ✅ Kardex: cada cambio de `stock` genera un `StockMovement` (`IN`/`OUT`/`ADJUSTMENT`) en la misma transacción — `/panel/kardex` lista los últimos 100 con formulario de registro manual.
3. ✅ Tienda pública (`/sites/[tenant]/catalogo`, `/producto/[slug]`) con `ProductCard`, filtros de búsqueda/categoría, sanitización de `costPrice`/`reservedStock` para visitantes no-staff (`toPublicProduct`).
4. ✅ Carrito (Zustand + `localStorage`, `skipHydration` para evitar el mismatch de hidratación) → `/checkout` → `POST /api/orders`: reserva de stock transaccional con lock de fila (`SELECT ... FOR UPDATE`), `WHERE` del lock filtrado también por `tenant_id`, orden estable de items por `variantId` para evitar deadlocks entre checkouts concurrentes. **Test de concurrencia real corrido contra Postgres**: stock=1, 10 requests simultáneas, exactamente 1 con `201` y 9 con `409 Stock insuficiente` — confirmado, `stock`/`reserved_stock` consistentes al final.
5. ✅ Expiración de reservas: BullMQ + Redis (mismo contenedor `flashkings-redis` reusado), `jobId = orderId` (idempotente), worker standalone (`src/worker.ts`, `bun run start:worker`) — arrancado y confirmado procesando jobs (incluido un no-op correcto sobre una orden ya resuelta).
6. ✅ `/panel/pedidos`: lista de pedidos con botones "Confirmar pago"/"Rechazar" (gateado por el feature `orderValidation`), conectado a `POST /api/orders/:id/confirm-payment` y `/reject-payment` — cierra el loop de la tarjeta "Validaciones pendientes" del dashboard. Verificado en vivo: confirmar decrementa `stock` y pone `PAID`; rechazar libera `reserved_stock` sin tocar `stock` y pone `CANCELLED`.
7. ✅ Página de confirmación de pedido (`/pedido/[orderId]/confirmacion`), pública vía UUID no adivinable.
8. ❌ **No incluido, a propósito** (fuera del alcance pedido): pasarela de pago real (Culqi u otra) — el checkout actual asume cobro fuera de la plataforma (Yape/Plin/efectivo) confirmado a mano por el staff, suficiente para el Cliente Piloto. Si un cliente futuro necesita cobro en línea automático, es un módulo nuevo detrás de un puerto tipo `IPaymentGateway`, no un cambio a lo ya construido.
9. ✅ Test de concurrencia *cross-tenant* (mismo SKU `CROSS-01` creado en piloto-01 y negocio-b, stock=1 en cada uno): agotar el de piloto-01 (`reserved_stock` 0→1) dejó `negocio-b` completamente intacto (`stock=1, reserved_stock=0`), que pudo vender su propia unidad sin ningún bloqueo — confirma que el `tenant_id` en el `WHERE` del lock aísla incluso con SKUs idénticos entre negocios.

## Fase 3 — POS y Facturación Electrónica SUNAT ✅ (parcial, verificado en vivo)

Objetivo: una venta (online o presencial) puede terminar en una boleta o factura real, válida ante SUNAT.

1. ✅ `/sites/[tenant]/panel/pos` (`PosTerminal.tsx`): venta presencial — busca por nombre/SKU, arma la venta, cobra. `POST /api/pos/sale` reutiliza el mismo lock de fila que el checkout online (`createOrderWithStockReservation`) pero, al ser una venta ya cobrada en el mostrador, decrementa `stock` y marca `PAID` de inmediato dentro de la misma transacción — no pasa por `PENDING_PAYMENT` ni genera hold. Gateado por el feature `posWeb`. Verificado en vivo: `stock` 10→8 tras vender 2 unidades, sin tocar `reserved_stock`.
2. ✅ Emisión de comprobantes (`src/domain/invoicing/`): mismo patrón exacto validado en Flashkings (`InvoicingGateway`, `fakeInvoicingGateway`, reserva del correlativo *antes* de llamar al proveedor — si el guardado fallara después, el número queda quemado, no se reutiliza). `InvoiceCounter` con clave compuesta `(tenantId, type)`: verificado en vivo que dos tenants distintos (piloto-01 y negocio-b) obtienen ambos `B001-1` de forma independiente, sin pisarse. `POST /api/orders/:id/invoice` gateado por `sunatInvoicing`, exige `order.status === 'PAID'` (409 si no) y rechaza doble emisión sobre la misma orden (409). Emisión manual desde `/panel/pedidos/[id]` (`InvoiceSection.tsx`), listado de comprobantes emitidos en `/panel/facturacion`.
3. ✅ Cálculo del desglose fiscal (`src/domain/invoicing/tax.ts`, `calculateTaxBreakdown`): IGV 18% calculado hacia atrás desde el total (precios ya incluyen IGV, práctica estándar B2C en Perú), tanto a nivel de `Invoice` como de cada `InvoiceItem`. Verificado en vivo: total 300 → `taxedAmount 254.24` / `igvAmount 45.76`.
4. ❌ Integración real con un PSE/OSE (Nubefact u otro) — **no conectada, a propósito**: ningún tenant está registrado como emisor electrónico ante SUNAT todavía (mismo estado que Flashkings). El seam ya existe (`src/lib/invoicing-gateway.ts`) y es el único archivo que cambiaría al conectar un proveedor real; falta agregar en `Tenant` dónde guardar las credenciales propias de cada negocio (cifradas) cuando corresponda.
5. ❌ Notas de crédito/débito — el schema ya soporta `relatedInvoiceId`/`InvoiceType.NOTA_CREDITO`/`NOTA_DEBITO`, pero no hay caso de uso ni UI todavía (tampoco existe en Flashkings; es trabajo greenfield). Menor prioridad que conectar un PSE real.

## Fase 4 — Crecimiento de la plataforma

Objetivo: cosas que importan para tener muchos clientes pagando, no para que el producto funcione.

1. **Dominios propios** — resolver el TODO explícito en `middleware.ts`: Edge Config o Upstash Redis para el mapeo `dominio → slug`, más la UI en `configuracion` para que un tenant registre su dominio y la verificación de propiedad (DNS TXT record, típicamente).
2. **Enforcement real de los límites de plan** (`planProductLimit`/`planInvoiceLimit`) — hoy son columnas sin ningún código que las lea; hay que decidir dónde se valida (¿al crear el producto/comprobante número N+1? ¿con un aviso previo?) y qué pasa cuando se excede (¿bloquea, o solo avisa?).
3. **Cobro del SaaS a sus propios clientes** (suscripción recurrente) — es un `Order`/`Invoice` más, pero del *dueño de la plataforma* facturándole a cada `Tenant`, no de un tenant facturándole a su cliente final. Vale la pena no mezclar este modelo con el de ventas de un tenant, aunque se parezcan.
4. Roles más finos para `SELLER` (¿puede ver costos? ¿puede anular una venta?) — hoy `UserRole` es un enum plano de 3 valores, suficiente para arrancar, no para un panel con permisos granulares.
5. Reportes/analítica por tenant (ventas por período, productos más vendidos, valorización de inventario) — la Fase 2 ya deja los datos (`StockMovement`, `OrderItem` con precio congelado); esto es sobre todo trabajo de queries agregadas y UI, no de modelo de datos nuevo.
