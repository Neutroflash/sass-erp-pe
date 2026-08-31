import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Fija app.tenant_id — leído por las políticas RLS de la migración
 * `20260831030000_add_row_level_security` — como PRIMER statement dentro de una transacción YA
 * abierta por el caller (ver reserve-stock.ts, resolve-order.ts). `SET LOCAL` no admite bind
 * parameters a nivel de protocolo Postgres, por eso `set_config()`: es una función SQL normal, sí
 * parametrizable vía el template tag de Prisma — nunca interpolar tenantId directo en un string.
 * El tercer argumento `true` = "is_local": el valor se pierde solo al terminar la transacción,
 * nunca se filtra a la siguiente vez que el pool reutilice esta misma conexión física.
 */
export async function setTenantForTransaction(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
}

/**
 * Para una operación aislada que no abre su propia transacción hoy (ej. un solo `findFirst` o
 * `upsert` suelto): abre una mini-transacción de dos statements en la MISMA conexión
 * (set_config + la operación real). Necesario porque Prisma reparte queries entre un pool de
 * conexiones — sin envolver ambas en una transacción, `set_config` y la query después podrían
 * caer en conexiones físicas distintas y la sesión nunca vería el tenant seteado.
 */
export async function withTenantRLS<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setTenantForTransaction(tx, tenantId);
    return fn(tx);
  });
}
