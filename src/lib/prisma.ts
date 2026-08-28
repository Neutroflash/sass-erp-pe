import { PrismaClient } from "@prisma/client";

// Patrón estándar de Next.js en dev: el hot-reload re-ejecuta este módulo en cada cambio, y sin
// cachear la instancia en globalThis se abriría una conexión nueva a Postgres por cada reload
// hasta agotar el pool. En producción (un solo proceso) esto es simplemente un singleton normal.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
