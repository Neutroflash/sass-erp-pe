import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RetrySunatButton } from "@/components/panel/RetrySunatButton";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "success" | "destructive" | "outline" | "secondary"> = {
  ISSUED: "success",
  FAILED: "destructive",
  VOID: "destructive",
  DRAFT: "outline",
  PENDING_SUNAT: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  ISSUED: "Emitido",
  FAILED: "Rechazado",
  VOID: "Anulado",
  DRAFT: "Borrador",
  PENDING_SUNAT: "Pendiente de envío",
};

export default async function FacturacionPage() {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "sunatInvoicing");

  const invoices = await prisma.invoice.findMany({
    where: { tenantId: tenant.id },
    include: { relatedInvoice: { select: { orderId: true, type: true, series: true, number: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const TYPE_LABEL: Record<string, string> = { BOLETA: "Boleta", FACTURA: "Factura", NOTA_CREDITO: "N. Crédito", NOTA_DEBITO: "N. Débito" };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-100">Facturación SUNAT</h1>
      <p className="text-sm text-zinc-400">
        Los comprobantes se emiten desde el detalle de cada pedido pagado, en{" "}
        <Link href="/panel/pedidos" className="text-yellow-400 hover:underline">
          Pedidos
        </Link>
        . Sin credenciales SUNAT configuradas en{" "}
        <Link href="/panel/configuracion" className="text-yellow-400 hover:underline">
          Configuración
        </Link>
        , la emisión queda simulada — ver el aviso al pie.
      </p>

      {invoices.length === 0 ? (
        <p className="text-sm text-zinc-500">Todavía no se ha emitido ningún comprobante.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md">
          <table className="w-full text-left">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Comprobante</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Total</th>
                <th className="p-3">Estado</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-zinc-800/60">
                  <td className="p-3 text-sm text-zinc-500">{new Date(inv.createdAt).toLocaleString("es-PE")}</td>
                  <td className="p-3 text-sm text-zinc-200">
                    {TYPE_LABEL[inv.type] ?? inv.type} {inv.series}-{inv.number}
                    {inv.relatedInvoice && (
                      <span className="ml-1 text-xs text-zinc-500">
                        (corrige {TYPE_LABEL[inv.relatedInvoice.type]} {inv.relatedInvoice.series}-{inv.relatedInvoice.number})
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-zinc-400">
                    {inv.documentType} {inv.documentNumber}
                    {inv.businessName ? ` · ${inv.businessName}` : ""}
                  </td>
                  <td className="p-3 text-sm font-medium text-yellow-400">{formatPrice(Number(inv.totalAmount))}</td>
                  <td className="p-3">
                    <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"}>{STATUS_LABEL[inv.status] ?? inv.status}</Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {(inv.orderId ?? inv.relatedInvoice?.orderId) && (
                        <Link href={`/panel/pedidos/${inv.orderId ?? inv.relatedInvoice?.orderId}`} className="text-xs text-yellow-400 hover:underline">
                          Ver pedido
                        </Link>
                      )}
                      {inv.status === "PENDING_SUNAT" && <RetrySunatButton invoiceId={inv.id} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-600">
        Sin credenciales SUNAT configuradas, los comprobantes emitidos usan un proveedor simulado (ver
        docs/ROADMAP.md). Con credenciales configuradas, la emisión es directa contra SUNAT — sin PSE/OSE de por
        medio — vía <code className="text-zinc-500">domain/invoicing/sunat/</code>.
      </p>
    </div>
  );
}
