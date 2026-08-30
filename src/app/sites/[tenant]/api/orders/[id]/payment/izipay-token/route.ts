import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { resolvePaymentGateway } from "@/lib/payment-gateway";

/**
 * Público (checkout de invitado) — llamado por el frontend justo después de crear el pedido
 * (`POST /api/orders`). Si el tenant no tiene Izipay configurado, responde `{configured:false}` y
 * el checkout sigue con el flujo de siempre (confirmación manual, `orderValidation`) sin mostrar
 * ningún widget de pago.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();

  const gateway = await resolvePaymentGateway(prisma, tenant.id);
  if (!gateway) {
    return NextResponse.json({ configured: false });
  }

  const order = await prisma.order.findFirst({ where: { id: params.id, tenantId: tenant.id } });
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ error: "Este pedido ya no está pendiente de pago" }, { status: 409 });
  }
  if (!order.customerEmail) {
    return NextResponse.json({ error: "Falta el correo del cliente para iniciar el pago en línea" }, { status: 400 });
  }

  try {
    const { formToken, publicKey } = await gateway.createFormToken({
      orderId: order.id,
      amount: Number(order.totalAmount),
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      customerPhone: order.customerPhone ?? undefined,
    });
    return NextResponse.json({ configured: true, formToken, publicKey });
  } catch (err) {
    console.error(`[izipay-token] no se pudo generar el formToken para la orden ${order.id}:`, err);
    return NextResponse.json({ error: "No se pudo iniciar el pago en línea, intenta de nuevo" }, { status: 502 });
  }
}
