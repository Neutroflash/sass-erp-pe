import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { resolvePaymentGateway } from "@/lib/payment-gateway";
import { markOrderPaid } from "@/domain/orders/resolve-order";
import { stockHoldScheduler } from "@/lib/stock-hold-queue";

/**
 * IPN de Izipay — notificación servidor-a-servidor, sin cookie de sesión (autenticidad = firma
 * HMAC, no auth de usuario). Content-Type es `application/x-www-form-urlencoded`, de ahí
 * `req.formData()` en vez de `req.json()`. Solo actúa sobre `paid === true`: un `UNPAID` no
 * cancela nada acá — el hold de 15 min (`stockHoldScheduler`) ya se encarga de expirar el pedido
 * si el pago nunca se completa, mismo mecanismo que el checkout sin pasarela.
 */
export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenant();

  const gateway = await resolvePaymentGateway(prisma, tenant.id);
  if (!gateway) {
    return NextResponse.json({ error: "Izipay no está configurado para este negocio" }, { status: 404 });
  }

  const form = await req.formData();
  const body: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") body[key] = value;
  }

  const event = gateway.verifyAndParseIpn(body);
  if (!event) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  if (event.paid) {
    const order = await prisma.order.findFirst({ where: { id: event.orderId, tenantId: tenant.id } });
    if (order) {
      const confirmed = await markOrderPaid(prisma, order.id);
      if (confirmed) {
        await stockHoldScheduler.cancel(order.id);
      }
    }
  }

  return NextResponse.json({ message: `OK! orderStatus procesado (paid=${event.paid})` });
}
