import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/api-guards";
import { runDueBillingCycles } from "@/domain/platform-billing/billing-cycle";

// Disparo manual del ciclo de facturación — el job recurrente (src/worker.ts) ya lo corre una vez
// al día solo, esto existe para que el SuperAdmin (o esta misma sesión, en desarrollo) no tenga
// que esperar hasta las 3am para ver el efecto de un cambio.
export async function POST() {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;

  const processed = await runDueBillingCycles(prisma);
  return NextResponse.json({ processed });
}
