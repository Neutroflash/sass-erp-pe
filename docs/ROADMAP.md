# Roadmap

Orden pensado para nunca quedar con un sistema a medias (cada fase cierra un flujo completo, usable). No es una estimación de tiempo — es una secuencia de dependencias reales: no tiene sentido facturar (Fase 3) antes de poder vender (Fase 2), ni vender antes de que un negocio pueda registrarse y configurar su tienda (Fase 1).

## Fase 0 — Fundamentos (hecho en este scaffold)

- Estructura de carpetas, `schema.prisma` completo, `middleware.ts` de resolución de tenant por subdominio, `lib/prisma.ts`, `lib/tenant-context.ts`.
- Dos páginas de punta a punta como prueba de que el patrón funciona (`/admin/tenants`, `/sites/[tenant]`) — build y typecheck verificados.
- **No hecho todavía, y a propósito**: nada de autenticación, nada de UI real, nada de lógica de negocio. Es el esqueleto, no el producto.

## Fase 1 — Plataforma y onboarding

Objetivo: un negocio puede registrarse solo y llegar a un panel vacío pero suyo, protegido.

1. Auth de `PlatformAdmin` (login simple, cookie httpOnly — mismo patrón ya probado en Flashkings: JWT access+refresh, bcrypt).
2. Auth de `User` dentro de un tenant (un `OWNER` se crea automáticamente al registrar el negocio). Ojo con el diseño ya tomado: el mismo email puede repetirse *entre* tenants distintos (son personas/cuentas independientes) — la unicidad es `(tenantId, email)`, nunca `email` a secas.
3. `/registro` (en `(marketing)`): formulario que crea `Tenant` + su primer `User` (`OWNER`) en una sola transacción. Validar que el `slug` elegido esté libre *antes* de mostrar éxito, no después.
4. Guard de acceso en `/admin/**` (rol `PlatformAdmin`) y en `/sites/[tenant]/panel/**` (rol `OWNER`/`SELLER` del *mismo* tenant que la URL — validar ambas cosas, no solo "está logueado").
5. `/sites/[tenant]/panel/configuracion`: logo, colores, RUC, razón social, dirección fiscal — hoy son columnas de `Tenant` sin ninguna UI que las edite.

**Punto delicado de esta fase**: el guard de rol debe verificar tenant Y rol juntos. Un `OWNER` del negocio A autenticado que visita `/sites/negocio-b/panel` debe rebotar — no alcanza con "es OWNER de algo".

## Fase 2 — Inventario, catálogo y ventas online

Objetivo: un negocio carga productos y un cliente final le compra en línea.

1. CRUD de `Category`/`Product`/`ProductVariant`/`ProductImage`, todo scoped por `tenantId` — literalmente el mismo panel de Flashkings (`InventoryTable`, `CreateProductForm`, `ProductImagesModal`) adaptado para leer/escribir siempre con el tenant actual en el filtro. Es la parte con más código ya resuelto en el otro repo; el trabajo real acá es la adaptación multi-tenant, no el diseño desde cero.
2. Kardex: cada cambio de `stock` en `ProductVariant` genera una fila en `StockMovement` en la misma transacción — nunca se actualiza `stock` sin dejar rastro de por qué.
3. Tienda pública (`/sites/[tenant]/catalogo`, `/producto/[slug]`) — reusar tal cual se pueda el diseño ya construido en Flashkings (`ProductCard`, `ProductGallery`, `CatalogGrid`), parametrizado por el tenant actual.
4. `POST /api/orders`: reserva de stock transaccional con lock de fila (`FOR UPDATE`), **igual que en Flashkings, pero el `WHERE` del lock y el conteo de disponibilidad ahora también filtran por `tenantId`** — dos tenants nunca deberían poder bloquearse mutuamente por una fila que ni siquiera comparten, así que en la práctica el índice `(tenantId, sku)` ya lo aísla, pero vale la pena un test de concurrencia que lo confirme explícitamente (crear el mismo SKU en dos tenants distintos, agotar stock del tenant A, confirmar que el tenant B no se ve afectado).
5. Expiración de reservas (BullMQ + Redis, o el equivalente que se elija) — mismo mecanismo que Flashkings, un solo worker sirviendo a todos los tenants a la vez (la cola ya es multi-tenant por diseño si cada job carga su propio `orderId`).

## Fase 3 — POS y Facturación Electrónica SUNAT

Objetivo: una venta (online o presencial) puede terminar en una boleta o factura real, válida ante SUNAT.

1. `/sites/[tenant]/panel/pos`: venta presencial — selecciona productos, cobra, genera un `Order` con `channel: POS` (sin dirección de envío, sin flujo de checkout online).
2. Emisión de comprobantes: reusar el diseño exacto ya validado en Flashkings (`IInvoicingGateway`, reserva del correlativo *antes* de llamar al proveedor, nunca después) — la diferencia real acá es que `InvoiceCounter` ahora tiene clave compuesta `(tenantId, type)`, así que cada negocio numera sus boletas/facturas de forma independiente desde F001-1 / B001-1.
3. Cálculo del desglose fiscal (`taxedAmount`/`igvAmount`/etc. en `Invoice`) — esto es lógica de negocio pura, pertenece a `src/domain/invoicing/`, no a un Route Handler ni a un componente.
4. Integración real con un PSE/OSE (Nubefact u otro) — **esto necesita, por cada tenant, sus propias credenciales del proveedor** (cada negocio tiene su propio RUC y su propia cuenta con el PSE). Diseñar `Tenant` con un campo para guardarlas (cifradas, no en texto plano) antes de escribir el adaptador — es un dato tenant-scoped más, del mismo tipo que RUC/razón social.
5. Notas de crédito/débito: usan `relatedInvoiceId` para apuntar al comprobante que corrigen — la UI debe partir siempre de "corregir esta factura", nunca crear una nota suelta sin ese vínculo.

## Fase 4 — Crecimiento de la plataforma

Objetivo: cosas que importan para tener muchos clientes pagando, no para que el producto funcione.

1. **Dominios propios** — resolver el TODO explícito en `middleware.ts`: Edge Config o Upstash Redis para el mapeo `dominio → slug`, más la UI en `configuracion` para que un tenant registre su dominio y la verificación de propiedad (DNS TXT record, típicamente).
2. **Enforcement real de los límites de plan** (`planProductLimit`/`planInvoiceLimit`) — hoy son columnas sin ningún código que las lea; hay que decidir dónde se valida (¿al crear el producto/comprobante número N+1? ¿con un aviso previo?) y qué pasa cuando se excede (¿bloquea, o solo avisa?).
3. **Cobro del SaaS a sus propios clientes** (suscripción recurrente) — es un `Order`/`Invoice` más, pero del *dueño de la plataforma* facturándole a cada `Tenant`, no de un tenant facturándole a su cliente final. Vale la pena no mezclar este modelo con el de ventas de un tenant, aunque se parezcan.
4. Roles más finos para `SELLER` (¿puede ver costos? ¿puede anular una venta?) — hoy `UserRole` es un enum plano de 3 valores, suficiente para arrancar, no para un panel con permisos granulares.
5. Reportes/analítica por tenant (ventas por período, productos más vendidos, valorización de inventario) — la Fase 2 ya deja los datos (`StockMovement`, `OrderItem` con precio congelado); esto es sobre todo trabajo de queries agregadas y UI, no de modelo de datos nuevo.
