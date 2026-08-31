import Link from "next/link";
import Image from "next/image";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { requirePublicStorefront } from "@/lib/feature-guards";
import { toPublicProduct } from "@/domain/inventory/product";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/ProductCard";

// Depende de headers() (middleware.ts) para saber qué tenant es — no se puede pre-renderizar en
// build sin esa información, y aunque se pudiera generar por tenant vía generateStaticParams más
// adelante, hoy conviene mantenerla dinámica: los datos de catálogo/precio cambian seguido.
export const dynamic = "force-dynamic";

const productInclude = { variants: true, images: true } satisfies Prisma.ProductInclude;

// Home de la tienda pública de un negocio — resuelto por middleware.ts a partir de
// {slug}.tusaas.pe (o, más adelante, de un dominio propio). No usa el parámetro de ruta [tenant]
// directamente: ese existe para que la carpeta sea una ruta válida, pero la fuente de verdad de
// "qué tenant es este" es siempre getCurrentTenant() (header inyectado por el middleware), nunca
// el segmento de URL crudo — así un dominio propio (sin slug real en la URL) funciona igual.
export default async function TenantStorefrontPage() {
  const tenant = await getCurrentTenant();
  await requirePublicStorefront(tenant.id);

  const featured = await prisma.product.findMany({
    where: { tenantId: tenant.id, isFeatured: true },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <div className="flex flex-col">
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            {tenant.logoUrl ? (
              <Image src={tenant.logoUrl} alt={tenant.businessName} width={32} height={32} unoptimized className="rounded-full" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {tenant.businessName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-sm font-bold text-zinc-100">{tenant.businessName}</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/catalogo" className="text-sm text-zinc-400 hover:text-zinc-100">
              Catálogo
            </Link>
            <Link href="/ingresar" className="text-sm text-zinc-400 hover:text-zinc-100">
              Ingresar
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-3 text-3xl font-bold text-zinc-100 sm:text-4xl">{tenant.businessName}</h1>
        <p className="mb-6 text-zinc-400">Bienvenido a nuestra tienda en línea.</p>
        <Link href="/catalogo">
          <Button>Ver catálogo</Button>
        </Link>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Destacados</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={toPublicProduct(product)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
