import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { setTenantForTransaction, withTenantRLS } from "@/lib/tenant-rls";
import { subQty } from "@/domain/inventory/quantity";
import { stockSchema } from "@/domain/inventory/quantity-schema";
import { unitCodeSchema } from "@/domain/inventory/quantity-schema";
import { TAX_AFFECTATION_CODES } from "@/domain/invoicing/tax-affectation";

// reservedStock intencionalmente ausente — lo gestiona solo el motor de reserva de órdenes
// (src/domain/orders/reserve-stock.ts), nunca una edición manual.
const updateVariantSchema = z.object({
  price: z.number().positive().optional(),
  costPrice: z.number().nonnegative().optional(),
  stock: stockSchema.optional(),
  unitCode: unitCodeSchema.optional(),
  taxAffectationCode: z.enum(TAX_AFFECTATION_CODES).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const parsed = updateVariantSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  // costPrice define el margen del negocio — un SELLER puede ajustar precio/stock del día a día,
  // pero no el costo (ver Fase 4 del roadmap, "roles más finos"). Rechazo explícito, no un
  // silencioso "ignoro el campo": si un SELLER lo mandó, algo en el cliente está mal.
  if (parsed.data.costPrice !== undefined && auth.user.role !== "OWNER") {
    return NextResponse.json({ error: "Solo el dueño del negocio puede editar el costo" }, { status: 403 });
  }

  const existing = await withTenantRLS(prisma, auth.tenantId, (tx) => tx.productVariant.findFirst({ where: { id: params.id, tenantId: auth.tenantId } }));
  if (!existing) {
    return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
  }

  const { stock, ...rest } = parsed.data;
  const stockDelta = stock !== undefined ? subQty(stock, existing.stock) : 0;

  // Si el stock cambió, el ajuste y el movimiento de kardex se registran en la MISMA transacción —
  // nunca debería poder existir un cambio de stock sin su fila correspondiente en StockMovement
  // explicando de dónde salió.
  const variant = await prisma.$transaction(async (tx) => {
    await setTenantForTransaction(tx, auth.tenantId);
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
