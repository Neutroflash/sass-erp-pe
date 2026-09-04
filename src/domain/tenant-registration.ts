import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { setTenantForTransaction } from "@/lib/tenant-rls";
import { DEFAULT_TENANT_FEATURES } from "./tenant-features";

export interface CreateTenantWithOwnerParams {
  slug: string;
  businessName: string;
  ownerName: string;
  email: string;
  passwordHash: string;
  emailVerificationTokenHash: string;
  emailVerificationTokenExpiresAt: Date;
}

export interface CreatedTenant {
  id: string;
  slug: string;
}

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Crea un negocio con su primer dueño y su fila de suscripción, en una sola transacción: nunca
 * debería poder existir un negocio sin al menos un OWNER, ni un tenant sin una suscripción que
 * trackee desde cuándo es cliente (incluso en FREE, que nunca se cobra — ver billing-cycle.ts).
 *
 * **El huevo y la gallina de RLS.** `users` y `platform_subscriptions` tienen políticas que exigen
 * `app.tenant_id`, pero acá el tenant se está creando en este mismo momento: no hay un "tenant
 * actual" que fijar antes de empezar. Se fija recién después del primer INSERT, con el id que
 * acaba de nacer.
 *
 * Que `tenants` no tenga política propia es lo que permite ese orden. Si algún día la tuviera, esto
 * hay que repensarlo entero.
 *
 * Vive acá y no dentro del Route Handler justamente por eso: es la única operación del proyecto que
 * escribe filas de un tenant *antes* de tener contexto de tenant, y el único lugar donde ese
 * invariante se puede probar contra Postgres real.
 */
export async function createTenantWithOwner(
  prisma: PrismaClient,
  params: CreateTenantWithOwnerParams,
): Promise<CreatedTenant> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug: params.slug,
        businessName: params.businessName,
        features: DEFAULT_TENANT_FEATURES as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, slug: true },
    });

    // Sin esto el registro falla con "new row violates row-level security policy for table
    // users", pero SOLO cuando la app corre con RUNTIME_DATABASE_URL (el rol sin privilegios, que
    // es la configuración de producción que recomienda docs/RLS.md). Con DATABASE_URL
    // —superusuario, exento de RLS— pasa sin ruido: el bug es invisible en cualquier entorno que
    // no tenga RLS realmente activo, y aparece recién en el primer registro real en producción.
    await setTenantForTransaction(tx, tenant.id);

    await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: params.email,
        passwordHash: params.passwordHash,
        name: params.ownerName,
        role: "OWNER",
        emailVerificationTokenHash: params.emailVerificationTokenHash,
        emailVerificationTokenExpiresAt: params.emailVerificationTokenExpiresAt,
      },
    });

    await tx.platformSubscription.create({
      data: {
        tenantId: tenant.id,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + ONE_MONTH_MS),
      },
    });

    return tenant;
  });
}
