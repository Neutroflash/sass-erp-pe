import type { Metadata } from "next";
import { getCurrentTenant } from "@/lib/tenant-context";
import { defaultTermsAndConditions } from "@/domain/legal/templates";

export const metadata: Metadata = { title: "Términos y Condiciones" };
export const dynamic = "force-dynamic";

export default async function TerminosPage() {
  const tenant = await getCurrentTenant();
  const text = tenant.termsAndConditions?.trim() || defaultTermsAndConditions(tenant);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Términos y Condiciones</h1>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{text}</div>
    </div>
  );
}
