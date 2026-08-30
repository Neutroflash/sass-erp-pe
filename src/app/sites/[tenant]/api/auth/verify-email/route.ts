import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { hashEmailVerificationToken } from "@/domain/email-verification";

const schema = z.object({ token: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const tenant = await getCurrentTenant();
  const tokenHash = hashEmailVerificationToken(parsed.data.token);

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, emailVerificationTokenHash: tokenHash, emailVerificationTokenExpiresAt: { gt: new Date() } },
  });
  if (!user) {
    return NextResponse.json({ error: "El enlace es inválido o ya venció — pide que te reenvíen la verificación" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationTokenExpiresAt: null },
  });

  return NextResponse.json({ message: "Correo verificado" });
}
