import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { withTenantRLS } from "@/lib/tenant-rls";

const updateImageSchema = z.object({
  url: z.string().url().optional(),
  altText: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

// product_images no tiene tenant_id propio ni política RLS (ver docs/RLS.md) — pero SÍ filtra acá
// por relación hacia products, que tiene RLS forzado: sin fijar app.tenant_id, ese JOIN implícito
// nunca matchea nada y esto devolvía "no encontrada" aunque la imagen existiera. Bug real,
// encontrado en vivo al usar el formulario de imágenes recién agregado.
async function findOwnedImage(imageId: string, tenantId: string) {
  return withTenantRLS(prisma, tenantId, (tx) =>
    tx.productImage.findFirst({ where: { id: imageId, product: { tenantId } }, include: { product: true } }),
  );
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const parsed = updateImageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const existing = await findOwnedImage(params.id, auth.tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
  }

  const image = await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.productImage.updateMany({
        where: { productId: existing.productId, NOT: { id: existing.id } },
        data: { isPrimary: false },
      });
    }
    return tx.productImage.update({ where: { id: existing.id }, data: parsed.data });
  });

  return NextResponse.json({ image });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const existing = await findOwnedImage(params.id, auth.tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
  }

  await prisma.productImage.delete({ where: { id: existing.id } });
  return new NextResponse(null, { status: 204 });
}
