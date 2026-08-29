import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Único punto de contacto entre el middleware (Edge Runtime, no puede usar Prisma) y la base de
 * datos para resolver un dominio propio — ver el TODO grande que reemplaza en src/middleware.ts.
 * Agrega un salto de red por cada request a un dominio propio (el middleware corre en Edge, esto
 * corre como función serverless Node aparte); a la escala de este proyecto es aceptable. Si el
 * volumen de tráfico por dominios propios crece lo suficiente para que la latencia importe, el
 * upgrade natural es Vercel Edge Config o Upstash Redis (ambos permiten leer desde el propio
 * middleware, sin este salto) — quedó documentado en el TODO original y no se descartó, solo se
 * pospuso: ninguno de los dos es viable hoy sin que el usuario cree una cuenta externa primero.
 *
 * Público a propósito (sin auth) — es un lookup dominio→slug, no expone nada que ese dominio
 * mismo no vaya a mostrar en un segundo. Solo resuelve dominios YA VERIFICADOS
 * (`customDomain`, nunca `customDomainPending`): nunca se rewritea tráfico hacia un tenant sin
 * confirmar antes que de verdad controla ese dominio.
 */
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host");
  if (!host) {
    return NextResponse.json({ error: "Falta el parámetro host" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { customDomain: host }, select: { slug: true } });
  if (!tenant) {
    return NextResponse.json({ error: "Dominio no reconocido" }, { status: 404 });
  }

  return NextResponse.json({ slug: tenant.slug });
}
