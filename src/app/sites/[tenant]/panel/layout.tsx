import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { getTenantFeatures } from "@/lib/features";
import { Sidebar } from "@/components/panel/Sidebar";
import { EmailVerificationBanner } from "@/components/panel/EmailVerificationBanner";

// Guard de todo /panel/**: sesión válida, DEL MISMO tenant que la URL actual, y con un rol que
// puede gestionar el negocio (CUSTOMER es un cliente final de la tienda pública — nunca del
// panel, aunque tenga una sesión válida en este mismo tenant). Server Component — el enforcement
// real vuelve a chequearse en cada Route Handler bajo /api/**, esto es solo la puerta de la UI.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser();

  if (!user || user.tenantId !== tenant.id || user.role === "CUSTOMER") {
    // /ingresar vive fuera de /panel a propósito — si estuviera anidada bajo panel/, este mismo
    // layout la volvería a guardar y el redirect entraría en loop infinito contra sí mismo.
    redirect(`/ingresar`);
  }

  const features = await getTenantFeatures(tenant.id);

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 md:grid-cols-[220px_1fr]">
      <Sidebar features={features} role={user.role} />
      <div className="min-w-0">
        {!user.emailVerifiedAt && <EmailVerificationBanner email={user.email} />}
        {children}
      </div>
    </div>
  );
}
