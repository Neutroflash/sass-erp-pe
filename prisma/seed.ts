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
};

async function main() {
  const passwordHash = await bcrypt.hash("Piloto123!", 12);

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

  console.log(`Seed completado — piloto-01.tusaas.pe (dev: localhost:3000 con Host: piloto-01.localhost)`);
  console.log(`Ingresar con owner@piloto.pe / Piloto123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
