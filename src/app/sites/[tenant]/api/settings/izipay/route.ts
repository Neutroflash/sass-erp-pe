import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantOwner } from "@/lib/api-guards";
import { encryptSecretString } from "@/lib/crypto";

const configSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  publicKey: z.string().trim().min(1),
  hmacKey: z.string().min(1),
});

// OWNER-only: credenciales de la cuenta comercio de Izipay, mismo criterio que SUNAT (identidad
// de cobro del negocio, no algo que un SELLER deba poder reconfigurar).
export async function GET() {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: auth.tenantId },
    select: { izipayUsername: true, izipayPasswordEnc: true, izipayPublicKey: true, izipayHmacKeyEnc: true },
  });

  return NextResponse.json({
    // Nunca se devuelve ningún secreto descifrado — solo si ya hay algo configurado.
    configured: Boolean(tenant.izipayUsername && tenant.izipayPasswordEnc && tenant.izipayPublicKey && tenant.izipayHmacKeyEnc),
    username: tenant.izipayUsername,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const parsed = configSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }
  const { username, password, publicKey, hmacKey } = parsed.data;

  await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: {
      izipayUsername: username,
      izipayPasswordEnc: encryptSecretString(password),
      izipayPublicKey: publicKey,
      izipayHmacKeyEnc: encryptSecretString(hmacKey),
    },
  });

  return NextResponse.json({ configured: true, username });
}

export async function DELETE() {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: { izipayUsername: null, izipayPasswordEnc: null, izipayPublicKey: null, izipayHmacKeyEnc: null },
  });

  return NextResponse.json({ configured: false });
}
