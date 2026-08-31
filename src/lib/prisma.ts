import { PrismaClient } from "@prisma/client";

// Patrón estándar de Next.js en dev: el hot-reload re-ejecuta este módulo en cada cambio, y sin
// cachear la instancia en globalThis se abriría una conexión nueva a Postgres por cada reload
// hasta agotar el pool. En producción (un solo proceso) esto es simplemente un singleton normal.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// RUNTIME_DATABASE_URL (rol flashstock_app, sin ser dueño de ninguna tabla) es opcional a
// propósito — ver docs/RLS.md. Mientras no exista, cae a DATABASE_URL (el rol dueño de las
// migraciones) y las políticas RLS quedan sin efecto contra esa conexión, exactamente el
// comportamiento de antes de esta migración. Este es el ÚNICO punto del repo que decide qué rol
// usa el Prisma Client en runtime.
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(runtimeUrl ? { datasources: { db: { url: runtimeUrl } } } : undefined);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
