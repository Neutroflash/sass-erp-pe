import Link from "next/link";
import { Prisma, InvoiceStatus, InvoiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { DataTable } from "@/components/panel/data-table/data-table";
import { columns, STATUS_LABEL, TYPE_LABEL, type AdminInvoiceRow } from "@/components/panel/facturacion/columns";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 10;
const DOCUMENT_TYPES = ["BOLETA", "FACTURA", "NOTA_CREDITO", "NOTA_DEBITO"] as const;

const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }));

function parseEnumList<T extends string>(raw: string | undefined, valid: readonly T[]): T[] | undefined {
  if (!raw) return undefined;
  const values = raw.split(",").filter((v): v is T => (valid as readonly string[]).includes(v));
  return values.length > 0 ? values : undefined;
}

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: { page?: string; pageSize?: string; sort?: string; search?: string; status?: string; type?: string };
}) {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "sunatInvoicing");

  const page = Math.max(Number(searchParams.page) || 1, 1);
  const pageSize = Number(searchParams.pageSize) || DEFAULT_PAGE_SIZE;
  const [sortId, sortDir] = (searchParams.sort ?? "createdAt.desc").split(".");
  const direction: Prisma.SortOrder = sortDir === "asc" ? "asc" : "desc";
  const orderBy: Prisma.InvoiceOrderByWithRelationInput = sortId === "totalAmount" ? { totalAmount: direction } : { createdAt: direction };
  const statusFilter = parseEnumList(searchParams.status, Object.values(InvoiceStatus));
  const typeFilter = parseEnumList(searchParams.type, DOCUMENT_TYPES as readonly InvoiceType[]);

  const where: Prisma.InvoiceWhereInput = {
    tenantId: tenant.id,
    ...(statusFilter ? { status: { in: statusFilter } } : {}),
    ...(typeFilter ? { type: { in: typeFilter } } : {}),
    ...(searchParams.search
      ? {
          OR: [
            { documentNumber: { contains: searchParams.search, mode: "insensitive" as const } },
            { businessName: { contains: searchParams.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [invoices, total] = await withTenantRLS(prisma, tenant.id, async (tx) => [
    await tx.invoice.findMany({
      where,
      include: { relatedInvoice: { select: { orderId: true, type: true, series: true, number: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    await tx.invoice.count({ where }),
  ]);

  const rows: AdminInvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    createdAt: inv.createdAt.toISOString(),
    type: inv.type as AdminInvoiceRow["type"],
    series: inv.series,
    number: inv.number,
    documentType: inv.documentType,
    documentNumber: inv.documentNumber,
    businessName: inv.businessName,
    totalAmount: Number(inv.totalAmount),
    status: inv.status,
    orderId: inv.orderId ?? inv.relatedInvoice?.orderId ?? null,
    correctsLabel: inv.relatedInvoice
      ? `${TYPE_LABEL[inv.relatedInvoice.type as AdminInvoiceRow["type"]] ?? inv.relatedInvoice.type} ${inv.relatedInvoice.series}-${inv.relatedInvoice.number}`
      : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Facturación SUNAT</h1>
      <p className="text-sm text-muted-foreground">
        Los comprobantes se emiten desde el detalle de cada pedido pagado, en{" "}
        <Link href="/panel/pedidos" className="text-primary hover:underline">
          Pedidos
        </Link>
        . Sin credenciales SUNAT configuradas en{" "}
        <Link href="/panel/configuracion" className="text-primary hover:underline">
          Configuración
        </Link>
        , la emisión queda simulada — ver el aviso al pie.
      </p>

      <DataTable
        columns={columns}
        data={rows}
        pageCount={Math.max(Math.ceil(total / pageSize), 1)}
        total={total}
        searchPlaceholder="Buscar por documento o razón social..."
        facets={[
          { columnId: "status", title: "Estado", options: STATUS_OPTIONS },
          { columnId: "type", title: "Tipo", options: TYPE_OPTIONS },
        ]}
        emptyMessage="Todavía no se ha emitido ningún comprobante."
      />

      <p className="text-xs text-muted-foreground/70">
        Sin credenciales SUNAT configuradas, los comprobantes emitidos usan un proveedor simulado (ver
        docs/ROADMAP.md). Con credenciales configuradas, la emisión es directa contra SUNAT — sin PSE/OSE de por
        medio — vía <code className="text-muted-foreground">domain/invoicing/sunat/</code>.
      </p>
    </div>
  );
}
