import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { stockHoldScheduler } from "@/lib/stock-hold-queue";
import { releaseOrderHold } from "@/domain/orders/resolve-order";
import { withTenantRLS } from "@/lib/tenant-rls";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "orderValidation");
  if (denied) return denied;

  const order = await withTenantRLS(prisma, auth.tenantId, (tx) => tx.order.findFirst({ where: { id: params.id, tenantId: auth.tenantId } }));
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  const rejected = await releaseOrderHold(prisma, auth.tenantId, order.id);
  if (!rejected) {
    return NextResponse.json({ error: "La orden ya no está pendiente de pago" }, { status: 409 });
  }

  await stockHoldScheduler.cancel(order.id);
  return NextResponse.json({ message: "Pago rechazado, stock liberado" });
}
