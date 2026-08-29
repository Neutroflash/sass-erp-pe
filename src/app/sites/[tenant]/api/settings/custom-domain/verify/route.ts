import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOwner } from "@/lib/api-guards";
import { verifyDomainOwnership } from "@/domain/custom-domain";

export async function POST() {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: auth.tenantId },
    select: { customDomainPending: true, customDomainVerificationToken: true },
  });

  if (!tenant.customDomainPending || !tenant.customDomainVerificationToken) {
    return NextResponse.json({ error: "No hay ningún dominio pendiente de verificación" }, { status: 409 });
  }

  const verified = await verifyDomainOwnership(tenant.customDomainPending, tenant.customDomainVerificationToken);
  if (!verified) {
    return NextResponse.json({ verified: false, error: "Todavía no se encontró el registro TXT — la propagación de DNS puede tardar" }, { status: 409 });
  }

  // Otro tenant pudo haber verificado el mismo dominio en el medio tiempo — el `@unique` de
  // customDomain es la barrera real, este chequeo previo solo da un mensaje más claro que un
  // error crudo de constraint de Postgres.
  const claimedByOther = await prisma.tenant.findUnique({ where: { customDomain: tenant.customDomainPending }, select: { id: true } });
  if (claimedByOther && claimedByOther.id !== auth.tenantId) {
    return NextResponse.json({ error: "Ese dominio ya fue verificado por otro negocio mientras tanto" }, { status: 409 });
  }

  const updated = await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: {
      customDomain: tenant.customDomainPending,
      customDomainPending: null,
      customDomainVerificationToken: null,
      customDomainVerifiedAt: new Date(),
    },
  });

  return NextResponse.json({ verified: true, customDomain: updated.customDomain });
}
