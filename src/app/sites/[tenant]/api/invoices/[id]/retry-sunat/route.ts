import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantOwner } from "@/lib/api-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { retryPendingSunatInvoice } from "@/domain/invoicing/sunat/retry";

// Reintento manual e inmediato (fuera de la cola/backoff automático) — para cuando se agotaron
// los reintentos automáticos (ver SUNAT_RETRY_MAX_ATTEMPTS) y el OWNER quiere forzar uno ahora,
// por ejemplo después de confirmar que SUNAT volvió a estar disponible.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const invoice = await withTenantRLS(prisma, auth.tenantId, (tx) => tx.invoice.findFirst({ where: { id: params.id, tenantId: auth.tenantId } }));
  if (!invoice) {
    return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  }
  if (invoice.status !== "PENDING_SUNAT") {
    return NextResponse.json({ error: "Este comprobante no está pendiente de reenvío" }, { status: 409 });
  }

  await retryPendingSunatInvoice(prisma, invoice.id);

  const updated = await withTenantRLS(prisma, auth.tenantId, (tx) => tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } }));
  return NextResponse.json({ status: updated.status });
}
