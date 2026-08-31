import { CartHydration } from "@/components/providers/CartHydration";
import { getCurrentTenant } from "@/lib/tenant-context";
import { tenantThemeVars } from "@/lib/tenant-theme";

// Envuelve TODO lo que vive bajo /sites/[tenant]/** — tienda pública Y panel (panel/layout.tsx
// está anidado adentro) — a propósito: el color primario del tenant aplica a ambos, no solo a la
// tienda que ve el cliente final. /admin (SuperAdmin de la plataforma) vive en un árbol de rutas
// completamente separado y nunca pasa por acá, así que se queda con el dorado fijo de siempre.
export default async function TenantSiteLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  const themeVars = tenantThemeVars(tenant.primaryColor);

  return (
    <div style={themeVars as React.CSSProperties}>
      <CartHydration />
      {children}
    </div>
  );
}
