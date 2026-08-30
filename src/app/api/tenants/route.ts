import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PasswordHasher } from "@/lib/password";
import { DEFAULT_TENANT_FEATURES } from "@/domain/tenant-features";
import { generateEmailVerificationToken, hashEmailVerificationToken, emailVerificationTokenExpiresAt } from "@/domain/email-verification";
import { sendVerificationEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "tusaas.pe";

// Solo accesible desde el dominio raíz (tusaas.pe/registro) — nunca desde el subdominio de un
// tenant, no tendría sentido "registrar un negocio nuevo" desde dentro de uno ya existente.
const registerSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones — va a ser tu subdominio"),
  businessName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, { scope: "registro", limit: 5, windowSeconds: 3600 });
  if (limited) return limited;

  const parsed = registerSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }
  const { slug, businessName, ownerName, email, password } = parsed.data;

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Ese subdominio ya está en uso" }, { status: 409 });
  }

  const passwordHash = await PasswordHasher.hash(password);

  // Tenant + su primer usuario (OWNER) + su PlatformSubscription, en una sola transacción — nunca
  // debería poder existir un negocio sin al menos un dueño, ni un tenant sin una fila de
  // suscripción (incluso en FREE, que nunca se cobra — ver billing-cycle.ts) que trackee desde
  // cuándo es cliente de la plataforma.
  const now = new Date();
  const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const verificationToken = generateEmailVerificationToken();

  const tenant = await prisma.$transaction(async (tx) => {
    const newTenant = await tx.tenant.create({
      data: {
        slug,
        businessName,
        features: DEFAULT_TENANT_FEATURES as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.user.create({
      data: {
        tenantId: newTenant.id,
        email,
        passwordHash,
        name: ownerName,
        role: "OWNER",
        emailVerificationTokenHash: hashEmailVerificationToken(verificationToken),
        emailVerificationTokenExpiresAt: emailVerificationTokenExpiresAt(),
      },
    });
    await tx.platformSubscription.create({
      data: { tenantId: newTenant.id, currentPeriodStart: now, currentPeriodEnd: oneMonthFromNow },
    });
    return newTenant;
  });

  // Best-effort: si el correo falla (proveedor caído, etc.) el registro ya se completó igual — no
  // bloquea el acceso al panel, ver el comentario en User.emailVerifiedAt (schema.prisma).
  try {
    const verifyUrl = `https://${slug}.${ROOT_DOMAIN}/verificar-email?token=${verificationToken}`;
    await sendVerificationEmail({ to: email, recipientName: ownerName, verifyUrl });
  } catch (err) {
    console.error("[registro] no se pudo enviar el correo de verificación:", err);
  }

  return NextResponse.json({ tenant: { id: tenant.id, slug: tenant.slug } }, { status: 201 });
}
