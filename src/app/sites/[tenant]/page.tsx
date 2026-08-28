import { getCurrentTenant } from "@/lib/tenant-context";

// Depende de headers() (middleware.ts) para saber qué tenant es — no se puede pre-renderizar en
// build sin esa información, y aunque se pudiera generar por tenant vía generateStaticParams más
// adelante, hoy conviene mantenerla dinámica: los datos de catálogo/precio cambian seguido.
export const dynamic = "force-dynamic";

// Home de la tienda pública de un negocio — resuelto por middleware.ts a partir de
// {slug}.tusaas.pe (o, más adelante, de un dominio propio). No usa el parámetro de ruta [tenant]
// directamente: ese existe para que la carpeta sea una ruta válida, pero la fuente de verdad de
// "qué tenant es este" es siempre getCurrentTenant() (header inyectado por el middleware), nunca
// el segmento de URL crudo — así un dominio propio (sin slug real en la URL) funciona igual.
export default async function TenantStorefrontPage() {
  const tenant = await getCurrentTenant();

  return (
    <main>
      <h1>{tenant.businessName}</h1>
      <p>Catálogo de {tenant.businessName} — próximamente.</p>
    </main>
  );
}
