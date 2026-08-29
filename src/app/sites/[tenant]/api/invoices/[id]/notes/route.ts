import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { issueCreditDebitNoteForInvoice } from "@/domain/invoicing/issue-note";
import { InvoicePlanLimitError, RelatedInvoiceNotIssuedError, InvalidNoteReasonError } from "@/domain/invoicing/errors";

const issueNoteSchema = z
  .object({
    type: z.enum(["NOTA_CREDITO", "NOTA_DEBITO"]),
    reasonCode: z.string().min(1).max(2),
    mode: z.enum(["FULL", "CUSTOM"]),
    customAmount: z.number().positive().optional(),
    customDescription: z.string().trim().min(2).optional(),
  })
  .refine((data) => data.mode !== "CUSTOM" || (data.customAmount !== undefined && data.customDescription), {
    message: "customAmount y customDescription son requeridos en modo CUSTOM",
    path: ["customAmount"],
  });

// Misma barrera que la emisión de comprobantes normal (requireTenantStaff + sunatInvoicing) — una
// nota de crédito/débito es una emisión más, no una acción distinta de mayor o menor privilegio.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "sunatInvoicing");
  if (denied) return denied;

  const parsed = issueNoteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const note = await issueCreditDebitNoteForInvoice(prisma, {
      tenantId: auth.tenantId,
      relatedInvoiceId: params.id,
      ...parsed.data,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    if (err instanceof RelatedInvoiceNotIssuedError || err instanceof InvalidNoteReasonError || err instanceof InvoicePlanLimitError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof Error && err.message === "Comprobante no encontrado") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
