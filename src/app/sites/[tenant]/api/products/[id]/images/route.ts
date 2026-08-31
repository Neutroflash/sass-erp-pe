import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";
import { withTenantRLS } from "@/lib/tenant-rls";

const addImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

// Por URL únicamente — no hay servicio de almacenamiento (S3/Cloudinary) configurado en este
// proyecto todavía; el negocio sube la imagen a donde ya tenga (o a un Cloudinary propio) y pega
// el link. Mismo criterio ya usado en Flashkings.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const parsed = addImageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  const product = await withTenantRLS(prisma, auth.tenantId, (tx) => tx.product.findFirst({ where: { id: params.id, tenantId: auth.tenantId } }));
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  // product_images no tiene tenant_id propio ni política RLS todavía (ver docs/RLS.md) — este
  // transaction queda tal cual, sin set_config, a propósito.
  const image = await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.productImage.updateMany({ where: { productId: product.id }, data: { isPrimary: false } });
    }
    return tx.productImage.create({
      data: {
        productId: product.id,
        url: parsed.data.url,
        altText: parsed.data.altText,
        isPrimary: parsed.data.isPrimary ?? false,
      },
    });
  });

  return NextResponse.json({ image }, { status: 201 });
}
