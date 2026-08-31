import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requireTenantStaff } from "@/lib/api-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { slugify } from "@/lib/slugify";

// Público — la tienda y el formulario de "nuevo producto" del admin necesitan el mismo listado.
export async function GET() {
  const tenant = await getCurrentTenant();
  const categories = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.category.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" } }),
  );
  return NextResponse.json({ categories });
}

const createCategorySchema = z.object({
  name: z.string().min(2),
});

export async function POST(req: NextRequest) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const parsed = createCategorySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const slug = slugify(parsed.data.name);
  const existing = await withTenantRLS(prisma, auth.tenantId, (tx) =>
    tx.category.findUnique({ where: { tenantId_slug: { tenantId: auth.tenantId, slug } } }),
  );
  if (existing) {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }

  const category = await withTenantRLS(prisma, auth.tenantId, (tx) =>
    tx.category.create({ data: { tenantId: auth.tenantId, name: parsed.data.name, slug } }),
  );
  return NextResponse.json({ category }, { status: 201 });
}
