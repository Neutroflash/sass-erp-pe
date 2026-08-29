import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { parseTenantFeatures } from "@/domain/tenant-features";
import { SettingsForm } from "@/components/panel/SettingsForm";

export const dynamic = "force-dynamic";

// Solo OWNER: identidad fiscal/comercial y qué módulos tiene activos el negocio no son cosas que
// un SELLER deba poder tocar, aunque panel/layout.tsx ya lo deje entrar al resto del panel.
export default async function ConfiguracionPage() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser();
  if (!user || user.role !== "OWNER") {
    redirect("/panel");
  }

  const row = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenant.id },
    select: { businessName: true, ruc: true, fiscalAddress: true, logoUrl: true, primaryColor: true, features: true },
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-100">Configuración</h1>
      <SettingsForm
        initial={{
          businessName: row.businessName,
          ruc: row.ruc,
          fiscalAddress: row.fiscalAddress,
          logoUrl: row.logoUrl,
          primaryColor: row.primaryColor,
          features: parseTenantFeatures(row.features),
        }}
      />
    </div>
  );
}
