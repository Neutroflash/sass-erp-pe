import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { createPosSale } from "@/domain/orders/create-pos-sale";
import { InsufficientStockError } from "@/domain/orders/errors";
import { quantitySchema } from "@/domain/inventory/quantity-schema";
import { withTenantRLS } from "@/lib/tenant-rls";

const lineSchema = z.object({ variantId: z.string().uuid(), quantity: quantitySchema });

// Unión discriminada, no campos opcionales sueltos: a crédito el cliente es OBLIGATORIO. Una
// deuda a nombre de un texto libre no se puede cobrar —no hay a quién ir— y dejarlo opcional
// permitiría crear exactamente esa venta huérfana. Que lo garantice el tipo, no un if.
const cashSaleSchema = z.object({
  paymentTerm: z.literal("CASH").optional(),
  customerName: z.string().trim().optional(),
  customerId: z.string().uuid().optional(),
  items: z.array(lineSchema).min(1),
});

const creditSaleSchema = z.object({
  paymentTerm: z.literal("CREDIT"),
  customerId: z.string().uuid(),
  customerName: z.string().trim().optional(),
  dueDate: z.string().datetime().optional(),
  items: z.array(lineSchema).min(1),
});

const saleSchema = z.union([creditSaleSchema, cashSaleSchema]);

export async function POST(req: NextRequest) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "posWeb");
  if (denied) return denied;

  const parsed = saleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  // A crédito el nombre congelado del pedido sale de la FICHA, no de lo que mande el cliente HTTP.
  // El snapshot tiene que decir a nombre de quién se fió de verdad: si el frontend no lo manda (o
  // manda otro), el pedido quedaría diciendo "Cliente de mostrador" con una deuda a nombre de
  // Juan Pablo colgando de él.
  let frozenCustomerName = parsed.data.customerName;

  if (parsed.data.paymentTerm === "CREDIT") {
    const creditDenied = await assertFeatureOrRespond403(auth.tenantId, "creditSales");
    if (creditDenied) return creditDenied;

    const customer = await withTenantRLS(prisma, auth.tenantId, (tx) =>
      tx.customer.findFirst({ where: { id: parsed.data.customerId, tenantId: auth.tenantId }, select: { id: true, name: true } }),
    );
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    frozenCustomerName = customer.name;
  }

  try {
    const result = await prisma.$transaction((tx) =>
      createPosSale(tx, {
        tenantId: auth.tenantId,
        sellerId: auth.user.id,
        customerName: frozenCustomerName,
        customerId: parsed.data.customerId,
        items: parsed.data.items,
        paymentTerm: parsed.data.paymentTerm === "CREDIT" ? "CREDIT" : "CASH",
        dueDate: parsed.data.paymentTerm === "CREDIT" && parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      }),
    );
    return NextResponse.json({ orderId: result.orderId, totalAmount: result.totalAmount }, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
