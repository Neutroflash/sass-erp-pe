import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { createPosSale } from "@/domain/orders/create-pos-sale";
import { InsufficientStockError } from "@/domain/orders/errors";

const saleSchema = z.object({
  customerName: z.string().trim().optional(),
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "posWeb");
  if (denied) return denied;

  const parsed = saleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction((tx) =>
      createPosSale(tx, {
        tenantId: auth.tenantId,
        sellerId: auth.user.id,
        customerName: parsed.data.customerName,
        items: parsed.data.items,
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
