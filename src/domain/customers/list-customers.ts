import type { PrismaClient } from "@prisma/client";
import { withTenantRLS } from "@/lib/tenant-rls";
import { getOutstandingByCustomer } from "@/domain/reports/accounts-receivable";

export interface CustomerListRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  docType: string | null;
  docNumber: string | null;
  creditLimit: number | null;
  /** Cuánto debe hoy. Cero es el caso normal: la mayoría de clientes no tiene deuda abierta. */
  outstanding: number;
}

/**
 * Listado de clientes del negocio con su saldo.
 *
 * Trae a TODOS, no solo a los que deben — es la agenda del negocio, no la cartera de cobranza.
 * Para lo segundo está `getReceivables`, que filtra y ordena por urgencia.
 */
export async function listCustomers(prisma: PrismaClient, tenantId: string, search?: string): Promise<CustomerListRow[]> {
  const term = search?.trim();

  const [customers, outstandingByCustomer] = await Promise.all([
    withTenantRLS(prisma, tenantId, (tx) =>
      tx.customer.findMany({
        where: {
          tenantId,
          ...(term
            ? {
                OR: [
                  { name: { contains: term, mode: "insensitive" as const } },
                  { phone: { contains: term } },
                  { docNumber: { contains: term } },
                ],
              }
            : {}),
        },
        orderBy: { name: "asc" },
        take: 200,
      }),
    ),
    getOutstandingByCustomer(prisma, tenantId),
  ]);

  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    address: c.address,
    phone: c.phone,
    docType: c.docType,
    docNumber: c.docNumber,
    creditLimit: c.creditLimit === null ? null : Number(c.creditLimit),
    outstanding: outstandingByCustomer.get(c.id) ?? 0,
  }));
}
