import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireFeature } from "@/lib/feature-guards";
import { buildDebtNote } from "@/domain/customers/debt-note";
import { NotaDeDeuda } from "@/components/panel/NotaDeDeuda";
import { TicketActions } from "@/components/panel/TicketActions";
import { slugify } from "@/lib/slugify";

export const dynamic = "force-dynamic";

export default async function DebtNotePage({ params }: { params: { id: string } }) {
  const tenant = await getCurrentTenant();
  await requireFeature(tenant.id, "creditSales");

  const data = await buildDebtNote(prisma, tenant.id, params.id);
  if (!data) notFound();

  const fileName = `deuda-${slugify(data.cliente.name)}-${data.issuedAt.toISOString().slice(0, 10)}`;

  return (
    <div className="flex flex-col items-center gap-4 py-4 print:gap-0 print:py-0">
      <div className="w-full max-w-md print:hidden">
        <Link href={`/panel/clientes/${params.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver a la ficha
        </Link>
      </div>

      {data.lines.length === 0 ? (
        <p className="rounded-2xl border border-border/80 bg-card/60 px-6 py-10 text-center text-muted-foreground backdrop-blur-md">
          {data.cliente.name} no tiene deudas pendientes. No hay nada que imprimir.
        </p>
      ) : (
        <>
          <NotaDeDeuda data={data} />
          {/* Mismo par de acciones que el ticket: comparten formato de papel y mecánica de
              impresión, aunque sean documentos de naturaleza distinta. */}
          <TicketActions targetId="nota-de-deuda" fileName={fileName} />
        </>
      )}
    </div>
  );
}
