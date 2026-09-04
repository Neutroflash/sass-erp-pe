import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { assertFeatureOrRespond403 } from "@/lib/feature-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { listCustomers } from "@/domain/customers/list-customers";

// docType/docNumber ausentes a propósito en el alta rápida: el negocio no pide documento al
// fiarle a alguien que conoce, y exigirlo acá trabaría el mostrador. Se completa al emitir el
// primer comprobante que lo necesite (ver el PATCH más abajo).
const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  docType: z.enum(["DNI", "RUC", "CE", "PASAPORTE"]).optional(),
  docNumber: z.string().trim().optional(),
  creditLimit: z.number().nonnegative().optional(),
  notes: z.string().trim().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "creditSales");
  if (denied) return denied;

  const search = req.nextUrl.searchParams.get("q") ?? undefined;
  return NextResponse.json({ items: await listCustomers(prisma, auth.tenantId, search) });
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;
  const denied = await assertFeatureOrRespond403(auth.tenantId, "creditSales");
  if (denied) return denied;

  const parsed = createCustomerSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos de entrada inválidos" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const customer = await withTenantRLS(prisma, auth.tenantId, (tx) =>
    tx.customer.create({
      data: {
        tenantId: auth.tenantId,
        name: input.name,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        docType: input.docType ?? null,
        docNumber: input.docNumber || null,
        creditLimit: input.creditLimit ?? null,
        notes: input.notes || null,
      },
    }),
  );

  return NextResponse.json({ customer: { ...customer, creditLimit: customer.creditLimit === null ? null : Number(customer.creditLimit) } }, { status: 201 });
}
