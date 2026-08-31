import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { withTenantRLS } from "@/lib/tenant-rls";
import { generateEmailVerificationToken, hashEmailVerificationToken, emailVerificationTokenExpiresAt } from "@/domain/email-verification";
import { sendVerificationEmail } from "@/lib/email";

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "flashstock.pe";

// Cualquier usuario logueado de este tenant puede reenviarse su propia verificación — no hace
// falta ser OWNER/SELLER, esto no es una acción de gestión del negocio.
export async function POST() {
  const tenant = await getCurrentTenant();
  const user = await getCurrentTenantUser(tenant.id);
  if (!user || user.tenantId !== tenant.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fullUser = await withTenantRLS(prisma, tenant.id, (tx) => tx.user.findUniqueOrThrow({ where: { id: user.id } }));
  if (fullUser.emailVerifiedAt) {
    return NextResponse.json({ error: "Este correo ya está verificado" }, { status: 409 });
  }

  const token = generateEmailVerificationToken();
  await withTenantRLS(prisma, tenant.id, (tx) =>
    tx.user.update({
      where: { id: user.id },
      data: { emailVerificationTokenHash: hashEmailVerificationToken(token), emailVerificationTokenExpiresAt: emailVerificationTokenExpiresAt() },
    }),
  );

  const verifyUrl = `https://${tenant.slug}.${ROOT_DOMAIN}/verificar-email?token=${token}`;
  await sendVerificationEmail({ to: user.email, recipientName: user.name, verifyUrl });

  return NextResponse.json({ message: "Correo reenviado" });
}
