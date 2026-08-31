import type { Metadata } from "next";
import { getCurrentTenant } from "@/lib/tenant-context";
import { Navbar } from "@/components/storefront/Navbar";
import { Footer } from "@/components/storefront/Footer";
import { CartDrawer } from "@/components/storefront/CartDrawer";
import { WhatsAppButton } from "@/components/storefront/WhatsAppButton";

// Antes de esto, TODAS las páginas de {slug}.flashstock.pe heredaban el <title>/<meta
// description> genérico del root layout ("SaaS E-Commerce & ERP para Perú") — un cliente que
// comparte el link de un producto por WhatsApp veía esa copy, no el nombre del negocio. Acá se
// resuelve por tenant una sola vez; cada page.tsx bajo (storefront) puede sobreescribir el título
// (ver catalogo/page.tsx, producto/[slug]/page.tsx) gracias al `template` de abajo.
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  const description = `Tienda en línea de ${tenant.businessName}. Explora el catálogo y realiza tu pedido en minutos.`;

  return {
    title: { default: tenant.businessName, template: `%s | ${tenant.businessName}` },
    description,
    // El logo del tenant como favicon/OG image — antes usaba el favicon default de Next para
    // todos los negocios por igual.
    icons: tenant.logoUrl ? { icon: tenant.logoUrl } : undefined,
    openGraph: { title: tenant.businessName, description, images: tenant.logoUrl ? [tenant.logoUrl] : undefined },
  };
}

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
      <Footer
        tenantId={tenant.id}
        businessName={tenant.businessName}
        izipayEnabled={Boolean(tenant.izipayUsername)}
        fiscalAddress={tenant.fiscalAddress}
        whatsappNumber={tenant.whatsappNumber}
      />
      {tenant.whatsappNumber && <WhatsAppButton whatsappNumber={tenant.whatsappNumber} businessName={tenant.businessName} />}
    </div>
  );
}
