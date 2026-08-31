import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { withTenantRLS } from "@/lib/tenant-rls";

const schema = z.object({
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
});

// Chequeo NO autoritativo (sin lock de fila) para UX antes de ir a checkout — solo para avisar
// temprano "esto ya no tiene stock" en el carrito. La verificación real, con lock, ocurre en
// POST /api/orders (reserve-stock.ts) — un 200 acá nunca es garantía de que la reserva real vaya
// a tener éxito un segundo después.
export async function POST(req: NextRequest) {
  const tenant = await getCurrentTenant();
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const variantIds = parsed.data.items.map((i) => i.variantId);
  const variants = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.productVariant.findMany({ where: { id: { in: variantIds }, tenantId: tenant.id } }),
  );
  const byId = new Map(variants.map((v) => [v.id, v]));

  const items = parsed.data.items.map((item) => {
    const variant = byId.get(item.variantId);
    const available = variant ? variant.stock - variant.reservedStock : 0;
    return { variantId: item.variantId, requested: item.quantity, available, ok: available >= item.quantity };
  });

  return NextResponse.json({ ok: items.every((i) => i.ok), items });
}
