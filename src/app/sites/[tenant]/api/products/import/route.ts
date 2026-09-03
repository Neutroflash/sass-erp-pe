import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTenantOwner } from "@/lib/api-guards";
import { withTenantRLS } from "@/lib/tenant-rls";
import { resolvePlanLimits } from "@/domain/plan-limits";
import { parseInventoryCsv, type ImportIssue } from "@/domain/inventory/import-products";
import { saveImportedProducts } from "@/domain/inventory/save-imported-products";

// 4 MB de texto son ~50 000 filas de inventario — muy por encima del tope de 5000 filas que impone
// el parser, así que este límite solo existe para no leer un archivo enorme antes de rechazarlo.
const MAX_BYTES = 4 * 1024 * 1024;

const importSchema = z.object({
  csv: z.string().min(1).max(MAX_BYTES),
  /** Sin esto solo se valida y se devuelve el reporte — nada toca la base. */
  confirm: z.boolean().optional(),
});

/**
 * Importación masiva de inventario desde CSV.
 *
 * OWNER-only por el mismo motivo que `POST /api/products`: fija el costPrice inicial de cada
 * producto, que es una decisión de margen.
 *
 * Dos fases explícitas, con el MISMO endpoint: sin `confirm` devuelve el reporte de qué se va a
 * crear y qué está mal, sin escribir nada. Es lo que permite que quien migra vea los errores y
 * las advertencias de stock negativo ANTES de meterle 200 productos a su negocio, en vez de
 * descubrirlo después revisando el inventario a mano.
 */
export async function POST(req: NextRequest) {
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const parsed = importSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Archivo inválido o demasiado grande" }, { status: 400 });
  }

  const result = parseInventoryCsv(parsed.data.csv);

  // Choques con lo que ya existe en el negocio: se calculan siempre (también en el preview) porque
  // es exactamente la clase de problema que el usuario necesita ver antes de confirmar.
  const skus = result.products.flatMap((p) => p.variants.map((v) => v.sku));
  const conflicts: ImportIssue[] = [];
  if (skus.length > 0) {
    const existing = await withTenantRLS(prisma, auth.tenantId, (tx) =>
      tx.productVariant.findMany({ where: { tenantId: auth.tenantId, sku: { in: skus } }, select: { sku: true } }),
    );
    for (const { sku } of existing) {
      conflicts.push({ line: 0, column: "código", message: `El código "${sku}" ya existe en tu inventario` });
    }
  }

  const errors = [...result.errors, ...conflicts];
  const summary = {
    products: result.products.length,
    variants: skus.length,
    rows: result.totalRows,
    errors,
    warnings: result.warnings,
  };

  if (errors.length > 0) {
    return NextResponse.json({ ...summary, imported: false }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: auth.tenantId },
    select: { planTier: true, planProductLimit: true, planInvoiceLimit: true },
  });
  const { productLimit } = resolvePlanLimits(tenant);
  if (productLimit !== null) {
    const currentCount = await withTenantRLS(prisma, auth.tenantId, (tx) => tx.product.count({ where: { tenantId: auth.tenantId } }));
    if (currentCount + result.products.length > productLimit) {
      return NextResponse.json(
        {
          ...summary,
          imported: false,
          errors: [
            {
              line: 0,
              message: `El archivo trae ${result.products.length} productos y tu plan (${tenant.planTier}) admite ${productLimit} en total; ya tienes ${currentCount}.`,
            },
          ],
        },
        { status: 409 },
      );
    }
  }

  if (!parsed.data.confirm) {
    return NextResponse.json({ ...summary, imported: false, preview: result.products.slice(0, 20) });
  }

  const created = await saveImportedProducts(prisma, auth.tenantId, result.products);
  return NextResponse.json({ ...summary, imported: true, created });
}
