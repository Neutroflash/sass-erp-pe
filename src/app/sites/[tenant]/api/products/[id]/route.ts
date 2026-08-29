import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantStaff } from "@/lib/api-guards";

// slug deliberadamente ausente — es la URL pública del producto, cambiarla rompería enlaces ya
// compartidos/indexados. Mismo criterio que Flashkings.
const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  isFeatured: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenantStaff();
  if (auth instanceof NextResponse) return auth;

  const parsed = updateProductSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos" }, { status: 400 });
  }

  // findFirst con tenantId en el where, no findUnique+chequeo después — así un id de OTRO tenant
  // da 404 igual que un id inexistente, nunca revela "existe pero no es tuyo".
  const existing = await prisma.product.findFirst({ where: { id: params.id, tenantId: auth.tenantId } });
  if (!existing) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const product = await prisma.product.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ product });
}
