import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";

// Público — página de confirmación de pedido. El id es un UUID no adivinable, suficiente para
// este alcance (mismo criterio que Flashkings): no expone nada sensible de costos, solo lo que
// el propio comprador ya sabe de su pedido.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  const order = await prisma.order.findFirst({
    where: { id: params.id, tenantId: tenant.id },
    include: { items: { include: { variant: { select: { sku: true, name: true } } } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({ id: i.id, quantity: i.quantity, price: Number(i.price), variant: i.variant })),
    },
  });
}
