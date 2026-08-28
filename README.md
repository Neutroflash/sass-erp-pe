# SaaS E-Commerce & ERP para Perú

Plataforma multi-tenant: inventario, ventas (online + POS), y facturación electrónica SUNAT, para pymes de tecnología/retail. Nace como una evolución de la arquitectura de [Flashkings](https://github.com/Neutroflash/flashkings-webapp) — es un proyecto independiente, no un fork.

## Empezar

```bash
bun install
cp .env.example .env  # completar DATABASE_URL con un Postgres real
bunx prisma migrate dev --name init
bun run dev
```

## Documentación

- [`docs/MULTI_TENANT_ARCHITECTURE.md`](docs/MULTI_TENANT_ARCHITECTURE.md) — modelo de aislamiento, cómo se resuelve el tenant por request, árbol de directorios completo.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — plan de fases.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS + PostgreSQL + Prisma. Bun como package manager.
