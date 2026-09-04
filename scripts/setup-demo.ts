/**
 * Deja el negocio piloto listo para que un cliente lo pruebe, contra la base que apunte
 * `DATABASE_URL`. Pensado para correrse UNA vez después del primer despliegue.
 *
 *   DATABASE_URL="postgresql://..." \
 *   CERT_ENCRYPTION_KEY="..." \
 *   DEMO_DOMAIN="flashstock-piloto.vercel.app" \
 *   DEMO_PFX_PATH="$HOME/flashstock-credenciales/homologacion.pfx" \
 *   DEMO_PFX_PASSWORD="..." \
 *   bun run scripts/setup-demo.ts
 *
 * Idempotente: correrlo dos veces no duplica productos ni pisa datos que el cliente ya haya
 * cargado — los pasos que ya están hechos se saltan y lo dicen.
 *
 * Qué hace y por qué cada cosa:
 *
 * 1. **Dominio propio.** Le asigna al tenant el hostname que dio el hosting. Es lo que hace que
 *    esa URL abra directo SU negocio, sin subdominios comodín (que obligarían a un plan pago) y
 *    sin que el cliente vea nunca el sitio de marketing, el registro ni el panel de plataforma.
 * 2. **Módulos.** Prende inventario, POS, crédito y facturación — el recorrido completo que se le
 *    pide probar.
 * 3. **Inventario de demostración.** El mismo CSV de `docs/ejemplos/`, con los productos que el
 *    negocio reconoce como suyos.
 * 4. **Certificado de homologación.** Cifrado igual que desde el panel. Opcional: sin él, todo
 *    funciona menos emitir comprobantes.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { encryptSecret, encryptSecretString } from "../src/lib/crypto";
import { parseInventoryCsv } from "../src/domain/inventory/import-products";
import { saveImportedProducts } from "../src/domain/inventory/save-imported-products";
import type { TenantFeatures } from "../src/domain/tenant-features";

const SLUG = "piloto-01";
const CSV_PATH = "docs/ejemplos/inventario-demo.csv";

/** RUC de la cuenta SOL pública de pruebas de SUNAT. Solo sirve contra e-beta. */
const MODDATOS_RUC = "20000000001";
const MODDATOS_SOL_USER = "MODDATOS";
const MODDATOS_SOL_PASSWORD = "moddatos";

const DEMO_FEATURES: TenantFeatures = {
  inventoryManagement: true,
  posWeb: true,
  creditSales: true,
  sunatInvoicing: true,
  orderValidation: true,
  profitMargins: true,
  autoSendInvoiceEmail: false, // Resend sigue en sandbox: un correo que no llega confunde más que ayudar
  publicStorefront: false, // el cliente prueba el PANEL; la tienda pública es otra conversación
};

const prisma = new PrismaClient();

function step(n: number, text: string) {
  console.log(`\n[${n}] ${text}`);
}

async function main() {
  const domain = process.env.DEMO_DOMAIN?.trim();

  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) {
    console.error(`No existe el negocio "${SLUG}". Corré primero: bun run prisma:seed`);
    process.exit(1);
  }
  console.log(`Negocio: ${tenant.businessName} (${tenant.id})`);

  step(1, "Dominio y módulos");
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      ...(domain ? { customDomain: domain, customDomainVerifiedAt: new Date() } : {}),
      features: DEMO_FEATURES as unknown as object,
      ruc: tenant.ruc ?? MODDATOS_RUC,
      fiscalAddress: tenant.fiscalAddress ?? "Av. de prueba 123, Lima",
      sunatEnvironment: "BETA",
    },
  });
  console.log(domain ? `    dominio: https://${domain}` : "    dominio: (sin DEMO_DOMAIN, se dejó como estaba)");
  console.log(`    módulos: ${Object.entries(DEMO_FEATURES).filter(([, v]) => v).map(([k]) => k).join(", ")}`);

  step(2, "Inventario de demostración");
  const existing = await prisma.product.count({ where: { tenantId: tenant.id } });
  if (existing > 0) {
    console.log(`    ya hay ${existing} productos — no se toca nada`);
  } else {
    const parsed = parseInventoryCsv(readFileSync(CSV_PATH, "utf8"));
    if (parsed.errors.length > 0) {
      console.error("    el CSV tiene errores:", parsed.errors);
      process.exit(1);
    }
    const created = await saveImportedProducts(prisma, tenant.id, parsed.products);
    const variants = parsed.products.reduce((n, p) => n + p.variants.length, 0);
    console.log(`    ${created} productos, ${variants} variantes`);
  }

  step(3, "Certificado de homologación SUNAT");
  const pfxPath = process.env.DEMO_PFX_PATH;
  const pfxPassword = process.env.DEMO_PFX_PASSWORD;

  if (!pfxPath || !pfxPassword) {
    console.log("    omitido (falta DEMO_PFX_PATH o DEMO_PFX_PASSWORD)");
    console.log("    sin esto todo funciona menos emitir comprobantes — se puede subir después desde /panel/configuracion");
  } else if (!process.env.CERT_ENCRYPTION_KEY) {
    console.error("    falta CERT_ENCRYPTION_KEY: es la que cifra el certificado en la base");
    process.exit(1);
  } else {
    const pfxBuffer = readFileSync(pfxPath);
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        sunatSolUser: MODDATOS_SOL_USER,
        sunatSolPasswordEnc: encryptSecretString(MODDATOS_SOL_PASSWORD),
        sunatCertificateEnc: encryptSecret(pfxBuffer),
        sunatCertificatePasswordEnc: encryptSecretString(pfxPassword),
      },
    });
    console.log(`    cargado y cifrado (${pfxBuffer.length} bytes), usuario SOL ${MODDATOS_SOL_USER}`);
  }

  console.log("\nListo.");
  if (domain) console.log(`  Panel:  https://${domain}/panel`);
  console.log("  Acceso: owner@piloto.pe / Piloto123!");
  console.log("\n  Los comprobantes salen contra e-beta.sunat.gob.pe: son de ENSAYO, no válidos");
  console.log("  ante SUNAT. Decíselo al cliente antes de que emita el primero.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
