import { NextRequest, NextResponse } from "next/server";

// Dominio raíz de la plataforma SaaS. Cualquier hostname que no sea este (ni un subdominio de
// este) se trata como un dominio propio de un tenant — ver resolveCustomDomain() más abajo.
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "tusaas.pe";

export async function middleware(req: NextRequest) {
  // req.headers.get("host") incluye el puerto en local (localhost:3000) — se quita para poder
  // comparar limpio contra ROOT_DOMAIN tanto en dev como en producción.
  const hostname = (req.headers.get("host") ?? "").split(":")[0];
  const { pathname, search } = req.nextUrl;

  // 1) admin.tusaas.pe -> panel del SUPERADMIN de la plataforma (gestión de tenants/planes),
  // no confundir con el panel de un tenant individual (ese vive bajo /_sites/{tenant}/panel).
  if (hostname === `admin.${ROOT_DOMAIN}`) {
    return NextResponse.rewrite(new URL(`/admin${pathname}${search}`, req.url));
  }

  // 2) tusaas.pe / www.tusaas.pe -> sitio de marketing (landing, precios, registro de nuevos
  // negocios). Estas rutas ya viven en su path real (/, /precios, /registro), sin rewrite.
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return NextResponse.next();
  }

  // 3) {slug}.tusaas.pe -> tienda/panel de ESE negocio. El slug sale directo del hostname, sin
  // tocar la base de datos — este es el camino rápido y el que cubre la mayoría del tráfico.
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = hostname.slice(0, -(`.${ROOT_DOMAIN}`.length));
    return rewriteToTenant(req, slug);
  }

  // 4) Dominio propio de un tenant (ej. tiendadeljuan.pe) -> hay que resolver qué tenant es dueño
  // de ese dominio antes de poder rewritear — ver resolveCustomDomain() abajo.
  return resolveCustomDomain(req, hostname);
}

function rewriteToTenant(req: NextRequest, slug: string) {
  const url = req.nextUrl.clone();
  // "sites", no "_sites" — un prefijo con guion bajo es una carpeta privada para Next.js (como
  // "_components"), quedaría excluida del árbol de rutas y esta reescritura apuntaría a la nada.
  url.pathname = `/sites/${slug}${req.nextUrl.pathname}`;
  const res = NextResponse.rewrite(url);
  // Header interno (nunca llega al navegador): lib/tenant-context.ts lo lee del lado servidor
  // vía headers() para saber "qué tenant es este request" sin volver a parsear el hostname en
  // cada Server Component / Route Handler.
  res.headers.set("x-tenant-slug", slug);
  return res;
}

// Resuelve un dominio propio (ej. tiendadeljuan.pe) vía api/resolve-domain — un Route Handler en
// runtime Node, porque Middleware corre en Edge Runtime y no puede abrir la conexión TCP
// persistente que Prisma necesita. Ver el comentario grande en ese Route Handler sobre el
// trade-off de latencia y el camino de upgrade (Edge Config/Upstash) cuando haga falta.
//
// Cualquier dominio no reconocido (o que falle el lookup) cae al sitio de marketing en vez de a
// un tenant fantasma — nunca se rewritea hacia un tenant sin confirmar antes que existe.
async function resolveCustomDomain(req: NextRequest, hostname: string): Promise<NextResponse> {
  try {
    const lookupUrl = new URL("/api/resolve-domain", req.url);
    lookupUrl.searchParams.set("host", hostname);
    const res = await fetch(lookupUrl, { headers: { "x-middleware-internal": "1" } });
    if (!res.ok) return NextResponse.next();

    const { slug } = (await res.json()) as { slug: string };
    return rewriteToTenant(req, slug);
  } catch {
    // Lookup caído/timeout — mismo criterio que "no reconocido": nunca se asume un tenant.
    return NextResponse.next();
  }
}

export const config = {
  // Corre en todo excepto assets estáticos y las rutas internas de Next — no tiene sentido (ni es
  // seguro) resolver un tenant para un request de /_next/static/....
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
