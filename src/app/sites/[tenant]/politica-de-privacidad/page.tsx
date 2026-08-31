import type { Metadata } from "next";
import { getCurrentTenant } from "@/lib/tenant-context";
import { defaultPrivacyPolicy } from "@/domain/legal/templates";

export const metadata: Metadata = { title: "Política de Privacidad" };
export const dynamic = "force-dynamic";

export default async function PoliticaPrivacidadPage() {
  const tenant = await getCurrentTenant();
  const text = tenant.privacyPolicy?.trim() || defaultPrivacyPolicy(tenant);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Política de Privacidad</h1>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{text}</div>
    </div>
  );
}
