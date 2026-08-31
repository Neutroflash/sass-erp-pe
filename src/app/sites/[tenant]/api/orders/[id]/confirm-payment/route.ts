import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { stockHoldScheduler } from "@/lib/stock-hold-queue";
import { markOrderPaid } from "@/domain/orders/resolve-order";
import { withTenantRLS } from "@/lib/tenant-rls";

// Gateado por el feature orderValidation — es literalmente la acción que ese módulo describe:
// el staff confirma a mano un pago (Yape/Plin, efectivo en POS) tras verificarlo por su cuenta.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "orderValidation");
  if (denied) return denied;

  const order = await withTenantRLS(prisma, auth.tenantId, (tx) => tx.order.findFirst({ where: { id: params.id, tenantId: auth.tenantId } }));
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  const confirmed = await markOrderPaid(prisma, auth.tenantId, order.id);
  if (!confirmed) {
    return NextResponse.json({ error: "La orden ya no está pendiente de pago" }, { status: 409 });
  }

  await stockHoldScheduler.cancel(order.id);
  return NextResponse.json({ message: "Pago confirmado" });
}
