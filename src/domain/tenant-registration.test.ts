import { describe, test, expect, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTenantWithOwner } from "./tenant-registration";

/**
 * Contra Postgres real, y **con el rol de runtime** (`prisma`, que respeta `RUNTIME_DATABASE_URL`)
 * — no con `setupClient`, que usa el rol dueño de las migraciones y está exento de RLS.
 *
 * Esa distinción es todo el punto de este archivo. El registro se rompía con
 * "new row violates row-level security policy for table users" y era invisible en cualquier
 * entorno sin RLS realmente activo: con el superusuario pasaba sin ruido, y habría aparecido
 * recién en el primer registro real en producción, que es exactamente donde `docs/RLS.md`
 * recomienda correr con el rol sin privilegios.
 */
const setupClient = new PrismaClient();
const created: string[] = [];

afterAll(async () => {
  if (created.length > 0) {
    await setupClient.tenant.deleteMany({ where: { id: { in: created } } });
  }
  await setupClient.$disconnect();
});

function params(slug: string) {
  return {
    slug,
    businessName: "Negocio de Prueba",
    ownerName: "Dueño de Prueba",
    email: `owner-${slug}@prueba.pe`,
    passwordHash: "$2a$12$hashfalsoquenoseusaparaautenticar",
    emailVerificationTokenHash: "hash-de-token",
    emailVerificationTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
}

describe("createTenantWithOwner — con RLS activo", () => {
  test("crea el negocio, su dueño y su suscripción en una sola transacción", async () => {
    const slug = `test-reg-${Date.now()}`;
    const tenant = await createTenantWithOwner(prisma, params(slug));
    created.push(tenant.id);

    expect(tenant.slug).toBe(slug);

    const owner = await setupClient.user.findFirst({ where: { tenantId: tenant.id } });
    expect(owner).toMatchObject({ role: "OWNER", name: "Dueño de Prueba" });

    const subscription = await setupClient.platformSubscription.findUnique({ where: { tenantId: tenant.id } });
    expect(subscription?.status).toBe("ACTIVE");
  });

  test("un slug repetido no deja un negocio a medio crear", async () => {
    const slug = `test-reg-dup-${Date.now()}`;
    const first = await createTenantWithOwner(prisma, params(slug));
    created.push(first.id);

    await expect(createTenantWithOwner(prisma, params(slug))).rejects.toThrow();

    // La transacción del segundo intento se revierte entera: sigue habiendo UN negocio con ese
    // slug y UN usuario, no un tenant huérfano ni un dueño duplicado.
    expect(await setupClient.tenant.count({ where: { slug } })).toBe(1);
    expect(await setupClient.user.count({ where: { tenantId: first.id } })).toBe(1);
  });

  test("el negocio nuevo nace vacío, sin ver datos de ningún otro", async () => {
    const slug = `test-reg-aislado-${Date.now()}`;
    const tenant = await createTenantWithOwner(prisma, params(slug));
    created.push(tenant.id);

    expect(await setupClient.product.count({ where: { tenantId: tenant.id } })).toBe(0);
    expect(await setupClient.customer.count({ where: { tenantId: tenant.id } })).toBe(0);
    expect(await setupClient.order.count({ where: { tenantId: tenant.id } })).toBe(0);
  });
});
