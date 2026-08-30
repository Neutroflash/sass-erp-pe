import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { generateResetToken, hashResetToken, resetTokenExpiresAt } from "@/domain/password-reset";
import { sendPasswordResetEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

// Siempre responde 200 con el mismo mensaje exista o no ese correo en este tenant — nunca revelar
// si un email está registrado es lo que evita que este endpoint sirva para enumerar usuarios.
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { scope: "forgot-password", limit: 5, windowSeconds: 600 });
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const tenant = await getCurrentTenant();
  const user = await prisma.user.findUnique({ where: { tenantId_email: { tenantId: tenant.id, email: parsed.data.email } } });

  if (user) {
    const token = generateResetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetTokenHash: hashResetToken(token), passwordResetTokenExpiresAt: resetTokenExpiresAt() },
    });

    const resetUrl = new URL(`/restablecer-password?token=${token}`, req.url).toString();
    try {
      await sendPasswordResetEmail({ to: user.email, recipientName: user.name, resetUrl });
    } catch (err) {
      // El envío puede fallar (proveedor caído, dominio de correo no verificado, etc.) — no se le
      // filtra al cliente, pero sí queda en logs del server para que alguien lo note.
      console.error("[forgot-password] no se pudo enviar el correo:", err);
    }
  }

  return NextResponse.json({ message: "Si el correo existe, enviamos instrucciones para restablecer la contraseña." });
}
