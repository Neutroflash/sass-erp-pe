import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { toPublicProduct } from "@/domain/inventory/product";
import { HeroSection } from "@/components/storefront/HeroSection";
import { CatalogGrid } from "@/components/storefront/CatalogGrid";
import { withTenantRLS } from "@/lib/tenant-rls";

// Depende de headers() (middleware.ts) para saber qué tenant es — no se puede pre-renderizar en
// build sin esa información, y aunque se pudiera generar por tenant vía generateStaticParams más
// adelante, hoy conviene mantenerla dinámica: los datos de catálogo/precio cambian seguido.
export const dynamic = "force-dynamic";

const productInclude = { variants: true, images: true } satisfies Prisma.ProductInclude;

// Home de la tienda pública de un negocio — resuelto por middleware.ts a partir de
// {slug}.flashstock.pe (o, más adelante, de un dominio propio). No usa el parámetro de ruta [tenant]
// directamente: ese existe para que la carpeta sea una ruta válida, pero la fuente de verdad de
// "qué tenant es este" es siempre getCurrentTenant() (header inyectado por el middleware), nunca
// el segmento de URL crudo — así un dominio propio (sin slug real en la URL) funciona igual.
//
// El Navbar/Footer y el guard de publicStorefront viven en (storefront)/layout.tsx, no acá — esta
// página solo aporta el Hero y los destacados.
export default async function TenantStorefrontPage() {
  const tenant = await getCurrentTenant();

  const featured = await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.product.findMany({
      where: { tenantId: tenant.id, isFeatured: true },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  );

  return (
    <div className="mx-auto max-w-7xl px-4">
      <HeroSection businessName={tenant.businessName} coverImageUrl={tenant.coverImageUrl} />

      {featured.length > 0 && (
        <section className="pb-16">
          <h2 className="mb-6 text-2xl font-bold text-zinc-100">Destacados</h2>
          <CatalogGrid products={featured.map(toPublicProduct)} />
        </section>
      )}
    </div>
  );
}
