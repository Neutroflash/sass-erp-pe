import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantOwner } from "@/lib/api-guards";
import { encryptSecret, encryptSecretString } from "@/lib/crypto";
import { parsePfx } from "@/domain/invoicing/sunat/certificate";

const configSchema = z.object({
  environment: z.enum(["BETA", "PRODUCCION"]),
  solUser: z.string().trim().min(1),
  solPassword: z.string().min(1),
  certificateBase64: z.string().min(1),
  certificatePassword: z.string().min(1),
});

// OWNER-only: RUC, clave SOL y certificado digital son la identidad tributaria del negocio ante
// SUNAT — nunca deberían poder configurarse desde una sesión de SELLER.
export async function GET() {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: auth.tenantId },
    select: { sunatEnvironment: true, sunatSolUser: true, sunatCertificateEnc: true },
  });

  return NextResponse.json({
    // Nunca se devuelve ningún secreto descifrado — solo si YA hay uno configurado, para que la UI
    // sepa mostrar "reemplazar certificado" en vez de "subir certificado".
    configured: Boolean(tenant.sunatSolUser && tenant.sunatCertificateEnc),
    environment: tenant.sunatEnvironment,
    solUser: tenant.sunatSolUser,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const parsed = configSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }
  const { environment, solUser, solPassword, certificateBase64, certificatePassword } = parsed.data;

  let pfxBuffer: Buffer;
  try {
    pfxBuffer = Buffer.from(certificateBase64, "base64");
  } catch {
    return NextResponse.json({ error: "El certificado no es un archivo válido" }, { status: 400 });
  }

  // Falla rápido y claro ANTES de cifrar/guardar nada: si la contraseña del .pfx está mal o el
  // archivo no es un certificado válido, mejor decirlo ahora que descubrirlo recién al intentar
  // emitir el primer comprobante.
  try {
    parsePfx(pfxBuffer, certificatePassword);
  } catch {
    return NextResponse.json({ error: "No se pudo leer el certificado — revisa el archivo y la contraseña" }, { status: 400 });
  }

  await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: {
      sunatEnvironment: environment,
      sunatSolUser: solUser,
      sunatSolPasswordEnc: encryptSecretString(solPassword),
      sunatCertificateEnc: encryptSecret(pfxBuffer),
      sunatCertificatePasswordEnc: encryptSecretString(certificatePassword),
    },
  });

  return NextResponse.json({ configured: true, environment, solUser });
}

export async function DELETE() {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: {
      sunatSolUser: null,
      sunatSolPasswordEnc: null,
      sunatCertificateEnc: null,
      sunatCertificatePasswordEnc: null,
    },
  });

  return NextResponse.json({ configured: false });
}
