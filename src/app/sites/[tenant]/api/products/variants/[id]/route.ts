import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";

// reservedStock intencionalmente ausente — lo gestiona solo el motor de reserva de órdenes
// (src/domain/orders/reserve-stock.ts), nunca una edición manual.
const updateVariantSchema = z.object({
  price: z.number().positive().optional(),
  costPrice: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const parsed = updateVariantSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const existing = await prisma.productVariant.findFirst({ where: { id: params.id, tenantId: auth.tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
  }

  const { stock, ...rest } = parsed.data;
  const stockDelta = stock !== undefined ? stock - existing.stock : 0;

  // Si el stock cambió, el ajuste y el movimiento de kardex se registran en la MISMA transacción —
  // nunca debería poder existir un cambio de stock sin su fila correspondiente en StockMovement
  // explicando de dónde salió.
  const variant = await prisma.$transaction(async (tx) => {
    const updated = await tx.productVariant.update({
      where: { id: params.id },
      data: { ...rest, ...(stock !== undefined ? { stock } : {}) },
    });

    if (stockDelta !== 0) {
      await tx.stockMovement.create({
        data: {
          tenantId: auth.tenantId,
          variantId: existing.id,
          type: stockDelta > 0 ? "IN" : "OUT",
          quantity: Math.abs(stockDelta),
          reason: "Ajuste rápido desde inventario",
          createdById: auth.user.id,
        },
      });
    }

    return updated;
  });

  return NextResponse.json({ variant: { ...variant, price: Number(variant.price), costPrice: Number(variant.costPrice) } });
}
