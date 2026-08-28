import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { platformAdminJwt } from "@/lib/jwt";
import { setPlatformAdminSessionCookies } from "@/lib/session-cookies";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Servido en admin.tusaas.pe/api/auth/login — cookies y JWT completamente separados del login de
// un usuario de tenant (ver session-cookies.ts / jwt.ts): un PlatformAdmin nunca debería poder
// "colarse" como usuario de un negocio ni viceversa.
export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const admin = await authenticatePlatformAdmin(parsed.data.email, parsed.data.password);
  if (!admin) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos" }, { status: 401 });
  }

  const claims = { sub: admin.id };
  setPlatformAdminSessionCookies(platformAdminJwt.signAccess(claims), platformAdminJwt.signRefresh(claims));

  return NextResponse.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
}
