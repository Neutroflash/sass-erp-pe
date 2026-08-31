# Arquitectura Multi-Tenant

## Modelo de aislamiento

Aislamiento **por columna** (`tenantId` en cada tabla de negocio), sobre una sola base Postgres compartida — no esquema-por-tenant ni base-por-tenant. Es la opción más barata de operar (una sola conexión, una sola migración corre para todos los negocios a la vez) y la que mejor escala para el volumen inicial (decenas/cientos de pymes, no miles de cuentas enterprise con requisitos de aislamiento contractual).

**El costo de esta elección**: no hay una barrera técnica que impida a un query mal escrito devolver datos de otro negocio — la barrera es disciplina de código. Regla dura, sin excepciones: **todo repositorio que toque una tabla con `tenantId` recibe el tenant actual como parámetro obligatorio, nunca opcional, y lo aplica en el `WHERE` de cada query.** Si el volumen o los requisitos de compliance de algún cliente grande lo justifican más adelante, migrar *ese* tenant a esquema o base separada es un cambio localizado, no una reescritura — pero no vale la pena pagar esa complejidad desde el día uno para todos.

## Resolución de tenant por request

```
navegador                    middleware.ts                    página/Route Handler
──────────                   ──────────────                    ────────────────────
GET clienteA.flashstock.pe/  →   parsea hostname                →  headers().get("x-tenant-slug")
                              extrae slug = "clienteA"           = "clienteA"
                              rewrite → /sites/clienteA/         │
                              header x-tenant-slug: clienteA     ▼
                                                               getCurrentTenant()
                                                               → prisma.tenant.findUnique({slug})
```

Tres casos, ver `src/middleware.ts`:

1. `admin.flashstock.pe` → panel del SUPERADMIN de la plataforma (`/admin/**`), sin relación con ningún tenant.
2. `flashstock.pe` / `www.flashstock.pe` → sitio de marketing (landing, precios, registro).
3. `{slug}.flashstock.pe` → tienda/panel de un negocio. El slug sale directo del hostname, sin tocar la base de datos.
4. Dominio propio de un tenant (`tiendadeljuan.pe`) → **pendiente de implementar** (ver el comentario largo en `middleware.ts`). Requiere un almacén compatible con Edge Runtime (Vercel Edge Config o Upstash Redis vía su cliente REST) para mapear `dominio → slug`, porque Prisma (conexión TCP) no corre dentro de Next.js Middleware.

## Por qué `/sites/[tenant]/` y no un route group

La primera versión de este árbol usaba `(tenant)` como *route group* — no aparece en la URL. Se descartó porque dos route groups distintos (`(marketing)` y `(tenant)`) no pueden tener cada uno su propio `page.tsx` resolviendo a `/`: Next.js lo rechaza en build por rutas duplicadas. `sites/[tenant]/` es una carpeta real con un segmento dinámico, así que puede convivir con `(marketing)` sin chocar — el middleware decide a cuál de las dos entrar reescribiendo la URL, nunca ambas reclaman el mismo path a la vez.

Nota aparte, ya corregida una vez en este proyecto: un prefijo con guion bajo (`_sites`) es una **carpeta privada** para Next.js (mismo mecanismo que `_components`) — queda excluida del árbol de rutas por convención. De ahí el nombre final `sites/`, sin guion bajo.

## Las rutas de API también viven bajo `sites/[tenant]/` — no en `app/api/` a secas

Segunda corrección real, más sutil que la anterior: el `matcher` de `middleware.ts` es `/((?!_next/static|_next/image|favicon.ico).*)` — **todo**, sin excepción para `/api/**`. Eso significa que una request del navegador a `{slug}.flashstock.pe/api/auth/login` pasa por el mismo rewrite que cualquier página: termina en `/sites/{slug}/api/auth/login` server-side. Un Route Handler puesto en `app/api/auth/login/route.ts` (nivel superior) nunca la recibiría — solo respondería a requests hacia el dominio raíz.

Regla que queda de esto: **si una ruta de API es sobre datos de UN negocio (login de su usuario, sus productos, sus órdenes), vive en `app/sites/[tenant]/api/**`.** Solo lo que es genuinamente de la plataforma entera (registrar un negocio nuevo — todavía no existe un tenant al que pertenecer — o un webhook de un proveedor externo que no conoce el concepto de subdominio) vive en `app/api/**` a secas, y lo que es del `PlatformAdmin` vive en `app/admin/api/**` (mismo rewrite, prefijo `/admin`).

## Árbol de directorios

```
saas-erp-pe/
├── prisma/
│   ├── schema.prisma               # Tenant (con features Json), PlatformAdmin, User, Category,
│   │                                # Product, ProductVariant, ProductImage, StockMovement, Order,
│   │                                # OrderItem, Invoice, InvoiceItem, InvoiceCounter
│   └── seed.ts                     # Cliente Piloto (piloto-01) + su usuario OWNER
├── src/
│   ├── middleware.ts                # resuelve el tenant a partir del hostname
│   ├── domain/
│   │   ├── tenant-features.ts        # TenantFeatures, defaults, parseTenantFeatures() defensivo
│   │   ├── inventory/                # VACÍO — Fase 2
│   │   ├── orders/                   # VACÍO — Fase 2
│   │   └── invoicing/                # VACÍO — Fase 3
│   ├── lib/
│   │   ├── prisma.ts                 # singleton de PrismaClient
│   │   ├── tenant-context.ts         # getCurrentTenant() — lee el header que deja el middleware
│   │   ├── password.ts               # bcrypt hash/verify
│   │   ├── jwt.ts                    # firma/verifica tokens — dos espacios separados (tenant/platform)
│   │   ├── session-cookies.ts        # cookies httpOnly host-only (sin `domain`, ver arriba)
│   │   ├── auth.ts                   # getCurrentTenantUser(), getCurrentPlatformAdmin(), authenticate*()
│   │   ├── features.ts               # getTenantFeatures(), hasFeature()
│   │   ├── feature-guards.ts         # requireFeature() (páginas), assertFeatureOrRespond403() (API)
│   │   └── utils.ts                  # cn(), formatPrice()
│   ├── components/
│   │   ├── storefront/               # VACÍO — UI de la tienda pública, Fase 2
│   │   ├── panel/
│   │   │   └── Sidebar.tsx            # nav dinámico según TenantFeatures — implementado
│   │   └── platform-admin/           # VACÍO — Fase 1 (auth de PlatformAdmin)
│   └── app/
│       ├── layout.tsx
│       ├── globals.css                # tema oscuro, mismos tokens que ADMIN_DESIGN_SYSTEM.md de Flashkings
│       ├── (marketing)/               # flashstock.pe — route group, no aparece en la URL
│       │   ├── page.tsx                # landing — implementado
│       │   ├── precios/page.tsx        # implementado (datos de ejemplo)
│       │   └── registro/               # PENDIENTE: falta el formulario (el endpoint ya existe, ver abajo)
│       ├── admin/                     # admin.flashstock.pe — panel del SUPERADMIN
│       │   ├── tenants/page.tsx        # lista de negocios — implementado, sin auth todavía (Fase 1)
│       │   └── api/auth/               # PENDIENTE: login/logout de PlatformAdmin (el modelo y los
│       │                                # helpers ya existen, falta el Route Handler y la página)
│       ├── sites/[tenant]/            # {slug}.flashstock.pe (o dominio propio, cuando exista la Fase 4)
│       │   ├── page.tsx                # home de la tienda — implementado (esqueleto)
│       │   ├── ingresar/page.tsx       # login del usuario del tenant — implementado
│       │   ├── catalogo/               # PENDIENTE (Fase 2)
│       │   ├── producto/[slug]/        # PENDIENTE (Fase 2)
│       │   ├── checkout/               # PENDIENTE (Fase 2)
│       │   ├── api/auth/               # login/logout del usuario del tenant — implementado
│       │   └── panel/
│       │       ├── layout.tsx          # guard: sesión + mismo tenant + rol OWNER/SELLER — implementado
│       │       ├── page.tsx            # dashboard con tarjetas condicionadas a features — implementado
│       │       ├── facturacion/page.tsx # ejemplo de requireFeature() bloqueando sunatInvoicing — implementado
│       │       ├── inventario/         # PENDIENTE (Fase 2)
│       │       ├── kardex/             # PENDIENTE (Fase 2)
│       │       ├── pedidos/            # PENDIENTE (Fase 2)
│       │       ├── pos/                # PENDIENTE (Fase 3)
│       │       └── configuracion/      # PENDIENTE (Fase 1 — logo/colores/RUC/features)
│       └── api/
│           ├── tenants/route.ts        # POST — registro de un negocio nuevo (Tenant + OWNER) — implementado
│           └── webhooks/pse/           # PENDIENTE (Fase 3)
├── .env.example
└── docs/
    ├── MULTI_TENANT_ARCHITECTURE.md  # este archivo
    └── ROADMAP.md
```

## Estado real a la fecha de este commit

**Verificado en vivo** (no solo con build): `bunx tsc --noEmit` y `bun run build` limpios (12 rutas), más un flujo completo contra una base Postgres real — `POST /api/tenants` registrando el negocio "negocio-b", login de su `OWNER`, dashboard del Cliente Piloto (sembrado vía `prisma/seed.ts`) mostrando exactamente sus 4 tarjetas activas, `/panel/facturacion` redirigiendo por tener `sunatInvoicing: false`, el link correspondiente ausente del Sidebar, y — el más importante de confirmar en vivo y no solo argumentar — la sesión del `OWNER` de "negocio-b" **no viajó** al pedir el panel de "piloto-01": la cookie es host-only, así que el navegador nunca la adjuntó a esa request, antes incluso de que el guard de código llegara a chequear nada.

Todo lo marcado PENDIENTE arriba es exactamente eso: en el mejor de los casos el backend/helper ya existe (auth de PlatformAdmin, registro de tenant), pero falta la página o el Route Handler que lo expone.
