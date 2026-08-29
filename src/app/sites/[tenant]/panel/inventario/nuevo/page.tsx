import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { CreateProductForm } from "@/components/panel/CreateProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const tenant = await getCurrentTenant();
  const categories = await prisma.category.findMany({ where: { tenantId: tenant.id }, orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-100">Nuevo producto</h1>
      <CreateProductForm categories={categories} />
    </div>
  );
}
