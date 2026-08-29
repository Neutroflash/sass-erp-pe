import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantOwner } from "@/lib/api-guards";
import { generateVerificationToken, isValidDomain, verificationRecordName } from "@/domain/custom-domain";

const claimSchema = z.object({ domain: z.string().trim().toLowerCase().min(4).max(253) });

// OWNER-only, mismo criterio que el resto de /panel/configuracion: cambiar a qué dominio responde
// el negocio es una decisión de identidad del negocio, no una tarea de piso de venta.
export async function POST(req: NextRequest) {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const parsed = claimSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }
  const { domain } = parsed.data;

  if (!isValidDomain(domain)) {
    return NextResponse.json({ error: "Ese no es un dominio válido" }, { status: 400 });
  }

  const existing = await prisma.tenant.findUnique({ where: { customDomain: domain }, select: { id: true } });
  if (existing && existing.id !== auth.tenantId) {
    return NextResponse.json({ error: "Ese dominio ya está verificado por otro negocio" }, { status: 409 });
  }

  const verificationToken = generateVerificationToken();
  await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: { customDomainPending: domain, customDomainVerificationToken: verificationToken, customDomainVerifiedAt: null },
  });

  return NextResponse.json({
    domain,
    txtRecordName: verificationRecordName(domain),
    txtRecordValue: verificationToken,
  });
}

export async function DELETE() {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: { customDomain: null, customDomainPending: null, customDomainVerificationToken: null, customDomainVerifiedAt: null },
  });

  return NextResponse.json({ ok: true });
}
