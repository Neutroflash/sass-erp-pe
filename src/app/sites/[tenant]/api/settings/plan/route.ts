import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantOwner } from "@/lib/api-guards";

const planSchema = z.object({ planTier: z.enum(["FREE", "STARTER", "PRO"]) });

// OWNER-only. Cambia el plan de inmediato — el cobro nuevo (o la falta de él, si baja a FREE) se
// aplica recién en el próximo ciclo de facturación (ver billing-cycle.ts): no se prorratea el
// período en curso, es una simplificación deliberada para no meterse en el cálculo de
// proporcionalidad de un cobro a mitad de mes.
export async function PATCH(req: NextRequest) {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const parsed = planSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const tenant = await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: { planTier: parsed.data.planTier },
  });

  return NextResponse.json({ planTier: tenant.planTier });
}
