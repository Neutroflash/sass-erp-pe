import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { issueInvoiceForOrder } from "@/domain/invoicing/issue-invoice";
import {
  OrderNotPaidError,
  InvoiceAlreadyIssuedError,
  InvoicePlanLimitError,
  BuyerIdentificationRequiredError,
} from "@/domain/invoicing/errors";
import { BUYER_DOCUMENT_TYPES, UNIDENTIFIED_DOCUMENT_NUMBER } from "@/domain/invoicing/buyer-identification";

const issueInvoiceSchema = z
  .object({
    type: z.enum(["BOLETA", "FACTURA"]),
    documentType: z.enum(BUYER_DOCUMENT_TYPES),
    // Opcional porque una boleta puede ir sin identificar al comprador. Cuándo es obligatorio
    // depende del MONTO del pedido, no del cuerpo de la petición, así que esa regla vive en el
    // dominio (validateBuyerIdentification) y no acá.
    documentNumber: z.string().trim().min(4).max(20).optional(),
    businessName: z.string().trim().min(2).optional(),
  })
  // SUNAT exige la razón social del comprador en una factura, no en una boleta.
  .refine((data) => data.type !== "FACTURA" || !!data.businessName, {
    message: "businessName es requerido para facturas",
    path: ["businessName"],
  })
  .refine((data) => data.documentType === "SIN_DOCUMENTO" || !!data.documentNumber, {
    message: "Falta el número de documento del comprador",
    path: ["documentNumber"],
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
      // SUNAT espera un valor en el campo, no un vacío: "0" es el que corresponde al tipo de
      // documento "0" (sin identificación).
      documentNumber: parsed.data.documentNumber ?? UNIDENTIFIED_DOCUMENT_NUMBER,
    });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    if (err instanceof OrderNotPaidError || err instanceof InvoiceAlreadyIssuedError || err instanceof InvoicePlanLimitError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    // 400 y no 409: falta un dato de la petición, y el usuario puede corregirlo pidiendo el DNI.
    if (err instanceof BuyerIdentificationRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.message === "Orden no encontrada") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
