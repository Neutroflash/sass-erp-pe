import { NextRequest, NextResponse } from "next/server";
import { redisConnection } from "./redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Ventana fija respaldada en Redis (INCR + EXPIRE) — no en memoria del proceso, a propósito: el
 * hosting recomendado (Vercel) corre funciones serverless que no comparten memoria entre
 * invocaciones, así que un limitador en memoria no limitaría nada de verdad ahí. Redis ya es una
 * dependencia del proyecto (BullMQ), esto reusa la misma conexión (`redisConnection`), no suma
 * infraestructura nueva.
 *
 * Ventana fija (no deslizante) a propósito: es más simple, una sola operación atómica por
 * request, y para el caso de uso (frenar fuerza bruta/abuso, no un rate limit de API pública de
 * precisión) el error en el borde de la ventana no importa.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;
  const count = await redisConnection.incr(redisKey);
  if (count === 1) {
    await redisConnection.expire(redisKey, windowSeconds);
  }
  const ttl = await redisConnection.ttl(redisKey);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetInSeconds: ttl > 0 ? ttl : windowSeconds };
}

/** IP del cliente — revisa `x-forwarded-for` (lo que setea Vercel y la mayoría de proxies/hosts)
 * antes de caer a un valor genérico. En dev casi siempre cae al fallback, que agrupa todo el
 * tráfico local bajo una sola clave — irrelevante para probar la lógica del límite en sí. */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Guard reusable para Route Handlers — mismo patrón que requireTenantStaff/requireTenantOwner
 * (devuelve una NextResponse lista para retornar si hay que frenar, `null` si puede seguir). Uso:
 *
 *   const limited = await enforceRateLimit(req, { scope: "login", limit: 8, windowSeconds: 600 });
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  req: NextRequest,
  options: { scope: string; limit: number; windowSeconds: number; identifier?: string },
): Promise<NextResponse | null> {
  const identifier = options.identifier ?? getClientIp(req);
  const result = await checkRateLimit(`${options.scope}:${identifier}`, options.limit, options.windowSeconds);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos — espera un momento antes de volver a intentar." },
      { status: 429, headers: { "Retry-After": String(result.resetInSeconds) } },
    );
  }
  return null;
}
