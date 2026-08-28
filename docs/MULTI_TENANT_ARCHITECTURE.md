# Arquitectura Multi-Tenant

## Modelo de aislamiento

Aislamiento **por columna** (`tenantId` en cada tabla de negocio), sobre una sola base Postgres compartida — no esquema-por-tenant ni base-por-tenant. Es la opción más barata de operar (una sola conexión, una sola migración corre para todos los negocios a la vez) y la que mejor escala para el volumen inicial (decenas/cientos de pymes, no miles de cuentas enterprise con requisitos de aislamiento contractual).

**El costo de esta elección**: no hay una barrera técnica que impida a un query mal escrito devolver datos de otro negocio — la barrera es disciplina de código. Regla dura, sin excepciones: **todo repositorio que toque una tabla con `tenantId` recibe el tenant actual como parámetro obligatorio, nunca opcional, y lo aplica en el `WHERE` de cada query.** Si el volumen o los requisitos de compliance de algún cliente grande lo justifican más adelante, migrar *ese* tenant a esquema o base separada es un cambio localizado, no una reescritura — pero no vale la pena pagar esa complejidad desde el día uno para todos.

## Resolución de tenant por request

```
navegador                    middleware.ts                    página/Route Handler
──────────                   ──────────────                    ────────────────────
GET clienteA.tusaas.pe/  →   parsea hostname                →  headers().get("x-tenant-slug")
                              extrae slug = "clienteA"           = "clienteA"
                              rewrite → /sites/clienteA/         │
                              header x-tenant-slug: clienteA     ▼
                                                               getCurrentTenant()
                                                               → prisma.tenant.findUnique({slug})
```

Tres casos, ver `src/middleware.ts`:

1. `admin.tusaas.pe` → panel del SUPERADMIN de la plataforma (`/admin/**`), sin relación con ningún tenant.
2. `tusaas.pe` / `www.tusaas.pe` → sitio de marketing (landing, precios, registro).
3. `{slug}.tusaas.pe` → tienda/panel de un negocio. El slug sale directo del hostname, sin tocar la base de datos.
4. Dominio propio de un tenant (`tiendadeljuan.pe`) → **pendiente de implementar** (ver el comentario largo en `middleware.ts`). Requiere un almacén compatible con Edge Runtime (Vercel Edge Config o Upstash Redis vía su cliente REST) para mapear `dominio → slug`, porque Prisma (conexión TCP) no corre dentro de Next.js Middleware.

## Por qué `/sites/[tenant]/` y no un route group

La primera versión de este árbol usaba `(tenant)` como *route group* — no aparece en la URL. Se descartó porque dos route groups distintos (`(marketing)` y `(tenant)`) no pueden tener cada uno su propio `page.tsx` resolviendo a `/`: Next.js lo rechaza en build por rutas duplicadas. `sites/[tenant]/` es una carpeta real con un segmento dinámico, así que puede convivir con `(marketing)` sin chocar — el middleware decide a cuál de las dos entrar reescribiendo la URL, nunca ambas reclaman el mismo path a la vez.

Nota aparte, ya corregida una vez en este proyecto: un prefijo con guion bajo (`_sites`) es una **carpeta privada** para Next.js (mismo mecanismo que `_components`) — queda excluida del árbol de rutas por convención. De ahí el nombre final `sites/`, sin guion bajo.

## Árbol de directorios

```
saas-erp-pe/
├── prisma/
│   └── schema.prisma              # Tenant, PlatformAdmin, User, Category, Product, ProductVariant,
│                                   # ProductImage, StockMovement, Order, OrderItem, Invoice,
│                                   # InvoiceItem, InvoiceCounter — ver el archivo, cada modelo
│                                   # tiene comentarios explicando las decisiones no obvias.
├── src/
│   ├── middleware.ts               # resuelve el tenant a partir del hostname
│   ├── lib/
│   │   ├── prisma.ts                # singleton de PrismaClient
│   │   └── tenant-context.ts        # getCurrentTenant() — lee el header que deja el middleware
│   ├── domain/                      # lógica de negocio pura, agnóstica de HTTP (mismo espíritu que
│   │   │                             # la Clean Architecture del backend de Flashkings) — VACÍO
│   │   │                             # todavía, se puebla en la Fase 2+ del roadmap.
│   │   ├── inventory/
│   │   ├── orders/
│   │   └── invoicing/
│   ├── components/
│   │   ├── storefront/              # UI de la tienda pública de un tenant
│   │   ├── panel/                   # UI del panel de gestión de un tenant (inventario, POS, facturación)
│   │   └── platform-admin/          # UI del panel del SUPERADMIN
│   └── app/
│       ├── layout.tsx
│       ├── globals.css
│       ├── (marketing)/             # tusaas.pe — route group, no aparece en la URL
│       │   ├── page.tsx              # landing — implementado
│       │   ├── precios/page.tsx      # implementado (datos de ejemplo, sin conectar a Tenant.planTier todavía)
│       │   └── registro/             # onboarding de un negocio nuevo — PENDIENTE (Fase 1)
│       ├── admin/                   # admin.tusaas.pe — panel del SUPERADMIN
│       │   └── tenants/page.tsx      # lista de negocios — implementado, sin auth todavía (Fase 1)
│       ├── sites/[tenant]/          # {slug}.tusaas.pe (o dominio propio, cuando exista la Fase 4)
│       │   ├── page.tsx              # home de la tienda — implementado (esqueleto)
│       │   ├── catalogo/             # PENDIENTE (Fase 2)
│       │   ├── producto/[slug]/      # PENDIENTE (Fase 2)
│       │   ├── checkout/             # PENDIENTE (Fase 2)
│       │   └── panel/                # gestión del negocio — todo PENDIENTE
│       │       ├── inventario/       # Fase 2
│       │       ├── kardex/           # Fase 2
│       │       ├── pedidos/          # Fase 2
│       │       ├── pos/              # Fase 3
│       │       ├── facturacion/      # Fase 3
│       │       └── configuracion/    # Fase 1 (logo/colores/RUC) + Fase 3 (métodos de pago)
│       └── api/
│           ├── auth/                 # PENDIENTE (Fase 1)
│           ├── products/             # PENDIENTE (Fase 2)
│           ├── orders/               # PENDIENTE (Fase 2)
│           ├── invoices/             # PENDIENTE (Fase 3)
│           └── webhooks/pse/         # callback del proveedor de facturación — PENDIENTE (Fase 3)
├── .env.example
└── docs/
    ├── MULTI_TENANT_ARCHITECTURE.md  # este archivo
    └── ROADMAP.md
```

## Estado real a la fecha de este commit

Lo único **verificado con build real** (no solo escrito): la estructura de carpetas completa, el schema de Prisma (`prisma generate` corre limpio), el middleware de resolución de tenant, `lib/prisma.ts` + `lib/tenant-context.ts`, y dos páginas de extremo a extremo (`/admin/tenants` listando tenants reales vía Prisma, `/sites/[tenant]` resolviendo el tenant actual vía el header del middleware) — `bunx tsc --noEmit` y `bun run build` pasan limpios. Todo lo marcado PENDIENTE arriba es exactamente eso: carpetas creadas, sin implementación.
