import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { setTenantForTransaction, withTenantRLS } from "@/lib/tenant-rls";
import { quantitySchema, stockSchema } from "@/domain/inventory/quantity-schema";
import { addQty, formatQty, hasEnough, subQty, toQty } from "@/domain/inventory/quantity";
import { unitShort } from "@/domain/inventory/units";

const baseSchema = z.object({
  variantId: z.string().uuid(),
  reason: z.string().trim().min(2).optional(),
});

// IN/OUT llevan una cantidad con signo implícito por el propio type ("entró"/"salió"). ADJUSTMENT
// en cambio pide el stock final directo ("el conteo físico dio 42"), no un delta — es la forma
// natural de registrar un conteo, y evita la ambigüedad de qué significa una "cantidad" con signo
// para un ajuste que puede ir para cualquier lado.
// Cada miembro con un único z.literal como discriminante (no z.enum) — es lo que permite que
// TypeScript/Zod narroween `input.type === "IN"` correctamente más abajo; un enum de 2 valores
// como discriminante de discriminatedUnion no infiere tan preciso.
const inSchema = baseSchema.extend({ type: z.literal("IN"), quantity: quantitySchema });
const outSchema = baseSchema.extend({ type: z.literal("OUT"), quantity: quantitySchema });
const adjustmentSchema = baseSchema.extend({ type: z.literal("ADJUSTMENT"), newStock: stockSchema });
const stockMovementSchema = z.discriminatedUnion("type", [inSchema, outSchema, adjustmentSchema]);

export async function GET() {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const movements = await withTenantRLS(prisma, auth.tenantId, (tx) =>
    tx.stockMovement.findMany({
      where: { tenantId: auth.tenantId },
      include: { variant: { select: { sku: true, name: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );

  return NextResponse.json({ items: movements });
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const parsed = stockMovementSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const variant = await withTenantRLS(prisma, auth.tenantId, (tx) => tx.productVariant.findFirst({ where: { id: input.variantId, tenantId: auth.tenantId } }));
  if (!variant) {
    return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
  }

  if (input.type === "OUT" && !hasEnough(variant.stock, input.quantity)) {
    return NextResponse.json(
      { error: `No hay suficiente stock: quedan ${formatQty(variant.stock)} ${unitShort(variant.unitCode)}` },
      { status: 409 },
    );
  }

  let newStock: number;
  let quantity: number;
  if (input.type === "IN") {
    newStock = addQty(variant.stock, input.quantity);
    quantity = toQty(input.quantity);
  } else if (input.type === "OUT") {
    newStock = subQty(variant.stock, input.quantity);
    quantity = toQty(input.quantity);
  } else {
    newStock = toQty(input.newStock);
    quantity = Math.abs(subQty(input.newStock, variant.stock));
  }

  const movement = await prisma.$transaction(async (tx) => {
    await setTenantForTransaction(tx, auth.tenantId);
    await tx.productVariant.update({ where: { id: variant.id }, data: { stock: newStock } });
    return tx.stockMovement.create({
      data: {
        tenantId: auth.tenantId,
        variantId: variant.id,
        type: input.type,
        quantity,
        reason: input.reason,
        createdById: auth.user.id,
      },
    });
  });

  return NextResponse.json({ movement }, { status: 201 });
}
