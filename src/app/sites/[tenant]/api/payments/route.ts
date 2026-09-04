import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { registerPayment } from "@/domain/payments/register-payment";
import { CustomerNotFoundError, OverpaymentError } from "@/domain/payments/errors";

const registerPaymentSchema = z.object({
  customerId: z.string().uuid(),
  // Dos decimales: es dinero, no una cantidad de tela. Un monto con más decimales acá sería
  // plata que no existe en ningún billete.
  amount: z.number().positive().max(9_999_999).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Máximo 2 decimales"),
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "YAPE", "PLIN", "TARJETA", "OTRO"]).optional(),
  note: z.string().trim().max(200).optional(),
});

/**
 * Registra un abono. El monto va contra el CLIENTE, no contra un pedido: el reparto entre sus
 * ventas abiertas lo resuelve el dominio (ver register-payment.ts).
 */
export async function POST(req: NextRequest) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "creditSales");
  if (denied) return denied;

  const parsed = registerPaymentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos de entrada inválidos" }, { status: 400 });
  }

  try {
    const result = await registerPayment(prisma, {
      tenantId: auth.tenantId,
      customerId: parsed.data.customerId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      note: parsed.data.note,
      createdById: auth.user.id,
    });
    return NextResponse.json({ payment: result }, { status: 201 });
  } catch (err) {
    // 409, no 400: el pedido está bien formado, lo que no cuadra es el estado de la cuenta.
    if (err instanceof OverpaymentError) {
      return NextResponse.json({ error: err.message, outstanding: err.outstanding }, { status: 409 });
    }
    if (err instanceof CustomerNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
