import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { withTenantRLS } from "@/lib/tenant-rls";
import { CreateProductForm } from "@/components/panel/CreateProductForm";

export const dynamic = "force-dynamic";

// OWNER-only: crear un producto fija su costPrice inicial — ver el comentario en POST /api/products.
export default async function NewProductPage() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser(tenant.id);
  if (!user || user.role !== "OWNER") {
    redirect("/panel/inventario");
  }

  const categories = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.category.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" } }),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-100">Nuevo producto</h1>
      <CreateProductForm categories={categories} />
    </div>
  );
}
