import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { withTenantRLS } from "@/lib/tenant-rls";
import { toPublicProduct } from "@/domain/inventory/product";

const productInclude = { variants: true, images: true } satisfies Prisma.ProductInclude;

// Público — usado por /sites/[tenant]/producto/[slug]. Sanitizado salvo que quien pregunte sea
// staff de este mismo tenant (mismo criterio que GET /api/products).
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const tenant = await getCurrentTenant();
  const product = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.product.findUnique({
      where: { tenantId_slug: { tenantId: tenant.id, slug: params.slug } },
      include: productInclude,
    }),
  );
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const user = await getCurrentTenantUser(tenant.id);
  const isStaff = user && user.tenantId === tenant.id && user.role !== "CUSTOMER";

  return NextResponse.json({
    product: isStaff
      ? { ...product, variants: product.variants.map((v) => ({ ...v, price: Number(v.price), costPrice: Number(v.costPrice) })) }
      : toPublicProduct(product),
  });
}
