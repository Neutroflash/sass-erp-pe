import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantOwner } from "@/lib/api-guards";
import { parseTenantFeatures } from "@/domain/tenant-features";

// Convierte "" (campo vaciado a mano en el form) en undefined — un update parcial simplemente
// omite ese campo (Prisma no lo toca) en vez de intentar validarlo como si fuera un valor real.
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

const settingsSchema = z.object({
  businessName: z.string().trim().min(2).optional(),
  ruc: z.preprocess(emptyToUndefined, z.string().regex(/^\d{11}$/).optional()),
  fiscalAddress: z.preprocess(emptyToUndefined, z.string().optional()),
  logoUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
  coverImageUrl: z.preprocess(emptyToUndefined, z.string().url().optional()),
  whatsappNumber: z.preprocess(emptyToUndefined, z.string().regex(/^\d{9,15}$/).optional()),
  primaryColor: z.preprocess(emptyToUndefined, z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()),
  termsAndConditions: z.preprocess(emptyToUndefined, z.string().max(20000).optional()),
  privacyPolicy: z.preprocess(emptyToUndefined, z.string().max(20000).optional()),
  // null = desactivar el resumen de stock bajo para este negocio (ver src/domain/inventory/low-stock.ts).
  lowStockThreshold: z.number().int().min(0).max(100000).nullable().optional(),
  features: z
    .object({
      sunatInvoicing: z.boolean(),
      inventoryManagement: z.boolean(),
      profitMargins: z.boolean(),
      orderValidation: z.boolean(),
      posWeb: z.boolean(),
      autoSendInvoiceEmail: z.boolean(),
      publicStorefront: z.boolean(),
    })
    .partial()
    .optional(),
});

// OWNER-only: identidad fiscal/comercial del negocio y qué módulos tiene activos. Un SELLER puede
// operar el día a día (POS, inventario, pedidos) pero no reconfigurar el negocio.
export async function PATCH(req: NextRequest) {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const parsed = settingsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }
  const { features: featurePatch, ...tenantFields } = parsed.data;

  const current = await prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { features: true } });
  const mergedFeatures = { ...parseTenantFeatures(current.features), ...featurePatch };

  const tenant = await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: {
      ...tenantFields,
      features: mergedFeatures as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    tenant: {
      businessName: tenant.businessName,
      ruc: tenant.ruc,
      fiscalAddress: tenant.fiscalAddress,
      logoUrl: tenant.logoUrl,
      coverImageUrl: tenant.coverImageUrl,
      whatsappNumber: tenant.whatsappNumber,
      primaryColor: tenant.primaryColor,
      termsAndConditions: tenant.termsAndConditions,
      privacyPolicy: tenant.privacyPolicy,
      lowStockThreshold: tenant.lowStockThreshold,
      features: mergedFeatures,
    },
  });
}
