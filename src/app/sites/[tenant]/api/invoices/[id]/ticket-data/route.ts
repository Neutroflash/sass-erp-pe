import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { buildTicketComprobanteData } from "@/domain/invoicing/ticket-data";

/** JSON del ticket, para cualquier consumidor que no sea la propia página del panel (que llama
 * `buildTicketComprobanteData` directamente — ver el comentario ahí). Mismos límites que `/pdf`. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const data = await buildTicketComprobanteData(prisma, auth.tenantId, params.id);
  if (!data) {
    return NextResponse.json({ error: "Comprobante no encontrado, no es Boleta/Factura, o todavía no fue aceptado por SUNAT" }, { status: 404 });
  }

  return NextResponse.json(data);
}
