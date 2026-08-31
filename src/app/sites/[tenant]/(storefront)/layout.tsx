import { getCurrentTenant } from "@/lib/tenant-context";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { CartDrawer } from "@/components/storefront/CartDrawer";

// Chrome de la tienda pública de un tenant (Navbar/Footer/carrito) — separado del layout de
// /panel/** (ese vive en panel/layout.tsx, con su propio Sidebar) aunque ambos comparten el mismo
// padre sites/[tenant]/layout.tsx (theming del primaryColor). Un route group `(storefront)` no
// agrega ningún segmento a la URL: /catalogo sigue siendo /catalogo.
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar businessName={tenant.businessName} logoUrl={tenant.logoUrl} />
      <CartDrawer />
      <main className="flex-1">{children}</main>
      <Footer tenantId={tenant.id} businessName={tenant.businessName} izipayEnabled={Boolean(tenant.izipayUsername)} />
    </div>
  );
}
