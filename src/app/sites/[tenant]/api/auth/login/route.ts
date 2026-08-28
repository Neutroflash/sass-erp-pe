import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateTenantUser } from "@/lib/auth";
import { tenantUserJwt } from "@/lib/jwt";
import { setTenantSessionCookies } from "@/lib/session-cookies";
import { getCurrentTenant } from "@/lib/tenant-context";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Servido en {slug}.tusaas.pe/api/auth/login — el middleware ya reescribió el path hasta acá
// (ver src/middleware.ts), así que getCurrentTenant() resuelve el tenant correcto desde el
// header que dejó, sin que el body del request necesite mandar ningún tenantId.
export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const tenant = await getCurrentTenant();
  const user = await authenticateTenantUser(tenant.id, parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
  }

  const claims = { sub: user.id, tenantId: user.tenantId, role: user.role };
  setTenantSessionCookies(tenantUserJwt.signAccess(claims), tenantUserJwt.signRefresh(claims));

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
