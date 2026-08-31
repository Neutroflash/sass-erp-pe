import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { createOrderWithStockReservation } from "@/domain/orders/reserve-stock";
import { InsufficientStockError } from "@/domain/orders/errors";
import { stockHoldScheduler } from "@/lib/stock-hold-queue";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertPublicStorefrontOrRespond404 } from "@/lib/feature-guards";

const cartItemSchema = z.object({ variantId: z.string().uuid(), quantity: z.number().int().positive() });

const createOrderSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().min(6).optional(),
  shippingAddress: z.string().min(5).optional(),
  items: z.array(cartItemSchema).min(1),
});

// Público — checkout de invitado o autenticado (getCurrentTenantUser() nunca lanza, así que un
// visitante sin sesión simplemente crea la orden con userId: null).
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { scope: "checkout", limit: 20, windowSeconds: 600 });
  if (limited) return limited;

  const tenant = await getCurrentTenant();
  const denied = await assertPublicStorefrontOrRespond404(tenant.id);
  if (denied) return denied;

  const parsed = createOrderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await getCurrentTenantUser(tenant.id);
  const currentUser = user && user.tenantId === tenant.id ? user : null;

  try {
    const result = await prisma.$transaction((tx) =>
      createOrderWithStockReservation(tx, {
        tenantId: tenant.id,
        userId: currentUser?.id ?? null,
        channel: "ONLINE",
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
        customerPhone: parsed.data.customerPhone,
        shippingAddress: parsed.data.shippingAddress,
        items: parsed.data.items,
      }),
    );

    await stockHoldScheduler.schedule(result.orderId);

    return NextResponse.json({ orderId: result.orderId, totalAmount: result.totalAmount }, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
