import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { TenantFeatures } from "../src/domain/tenant-features";

const prisma = new PrismaClient();

// Cliente 0 — usa solo inventario/márgenes/validación de órdenes/POS. Facturación SUNAT queda
// desactivada hasta que este negocio tenga sus propias credenciales con un PSE/OSE (Fase 3).
const PILOT_FEATURES: TenantFeatures = {
  sunatInvoicing: false,
  inventoryManagement: true,
  profitMargins: true,
  orderValidation: true,
  posWeb: true,
  autoSendInvoiceEmail: true,
  publicStorefront: true,
};

async function main() {
  const passwordHash = await bcrypt.hash("Piloto123!", 12);

  // SUPERADMIN de la plataforma (admin.tusaas.pe) — separado de cualquier User de tenant, ver el
  // comentario en schema.prisma sobre por qué es su propio modelo y no un rol más.
  const platformAdminPasswordHash = await bcrypt.hash("SuperAdmin123!", 12);
  await prisma.platformAdmin.upsert({
    where: { email: "admin@tusaas.pe" },
    update: {},
    create: {
      email: "admin@tusaas.pe",
      passwordHash: platformAdminPasswordHash,
      name: "SuperAdmin",
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "piloto-01" },
    update: { features: PILOT_FEATURES as unknown as Prisma.InputJsonValue },
    create: {
      slug: "piloto-01",
      businessName: "Cliente Piloto",
      features: PILOT_FEATURES as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "owner@piloto.pe" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "owner@piloto.pe",
      passwordHash,
      name: "Dueño Piloto",
      role: "OWNER",
    },
  });

  const now = new Date();
  await prisma.platformSubscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`Seed completado — piloto-01.tusaas.pe (dev: localhost:3000 con Host: piloto-01.localhost)`);
  console.log(`Ingresar con owner@piloto.pe / Piloto123!`);
  console.log(`SuperAdmin: admin@tusaas.pe / SuperAdmin123! (en admin.tusaas.pe/ingresar)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
