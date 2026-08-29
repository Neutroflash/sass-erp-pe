import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { StockMovementForm } from "@/components/panel/StockMovementForm";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { IN: "Entrada", OUT: "Salida", ADJUSTMENT: "Ajuste" };

export default async function KardexPage() {
  const tenant = await getCurrentTenant();

  const [variants, movements] = await Promise.all([
    prisma.productVariant.findMany({
      where: { tenantId: tenant.id },
      include: { product: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: { tenantId: tenant.id },
      include: { variant: { select: { sku: true, name: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-100">Kardex</h1>

      <StockMovementForm variants={variants.map((v) => ({ ...v, price: 0, costPrice: 0, productName: v.product.name }))} />

      <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md">
        <table className="w-full text-left">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Producto</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Cantidad</th>
              <th className="p-3">Motivo</th>
              <th className="p-3">Registrado por</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b border-zinc-800/60">
                <td className="p-3 text-sm text-zinc-500">{new Date(m.createdAt).toLocaleString("es-PE")}</td>
                <td className="p-3 text-sm text-zinc-300">
                  {m.variant.name} <span className="text-zinc-500">({m.variant.sku})</span>
                </td>
                <td className="p-3">
                  <Badge variant={m.type === "IN" ? "success" : m.type === "OUT" ? "destructive" : "outline"}>{TYPE_LABEL[m.type]}</Badge>
                </td>
                <td className="p-3 text-sm text-zinc-100">{m.quantity}</td>
                <td className="p-3 text-sm text-zinc-500">{m.reason ?? "—"}</td>
                <td className="p-3 text-sm text-zinc-500">{m.createdBy.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
