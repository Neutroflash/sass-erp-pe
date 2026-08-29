import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { issueInvoiceForOrder } from "@/domain/invoicing/issue-invoice";
import { OrderNotPaidError, InvoiceAlreadyIssuedError } from "@/domain/invoicing/errors";

const issueInvoiceSchema = z
  .object({
    type: z.enum(["BOLETA", "FACTURA"]),
    documentType: z.enum(["DNI", "RUC", "CE", "PASAPORTE"]),
    documentNumber: z.string().trim().min(4).max(20),
    businessName: z.string().trim().min(2).optional(),
  })
  // SUNAT exige la razón social del comprador en una factura, no en una boleta.
  .refine((data) => data.type !== "FACTURA" || !!data.businessName, {
    message: "businessName es requerido para facturas",
    path: ["businessName"],
  });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "sunatInvoicing");
  if (denied) return denied;

  const parsed = issueInvoiceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const invoice = await issueInvoiceForOrder(prisma, {
      tenantId: auth.tenantId,
      orderId: params.id,
      ...parsed.data,
    });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    if (err instanceof OrderNotPaidError || err instanceof InvoiceAlreadyIssuedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof Error && err.message === "Orden no encontrada") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
