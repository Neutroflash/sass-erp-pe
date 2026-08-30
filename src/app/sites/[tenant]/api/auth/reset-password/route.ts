import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { hashResetToken } from "@/domain/password-reset";
import { PasswordHasher } from "@/lib/password";

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos de entrada inválidos" }, { status: 400 });
  }

  const tenant = await getCurrentTenant();
  const tokenHash = hashResetToken(parsed.data.token);

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, passwordResetTokenHash: tokenHash, passwordResetTokenExpiresAt: { gt: new Date() } },
  });
  if (!user) {
    return NextResponse.json({ error: "El enlace es inválido o ya venció — solicita uno nuevo" }, { status: 400 });
  }

  const passwordHash = await PasswordHasher.hash(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetTokenHash: null, passwordResetTokenExpiresAt: null },
  });

  return NextResponse.json({ message: "Contraseña actualizada" });
}
