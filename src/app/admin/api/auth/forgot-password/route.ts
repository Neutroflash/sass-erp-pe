import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateResetToken, hashResetToken, resetTokenExpiresAt } from "@/domain/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

// Mismo criterio que el de tenant: siempre 200 con el mismo mensaje, nunca revela si el correo
// pertenece a un PlatformAdmin real.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const admin = await prisma.platformAdmin.findUnique({ where: { email: parsed.data.email } });

  if (admin) {
    const token = generateResetToken();
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { passwordResetTokenHash: hashResetToken(token), passwordResetTokenExpiresAt: resetTokenExpiresAt() },
    });

    const resetUrl = new URL(`/restablecer-password?token=${token}`, req.url).toString();
    try {
      await sendPasswordResetEmail({ to: admin.email, recipientName: admin.name, resetUrl });
    } catch (err) {
      console.error("[admin forgot-password] no se pudo enviar el correo:", err);
    }
  }

  return NextResponse.json({ message: "Si el correo existe, enviamos instrucciones para restablecer la contraseña." });
}
