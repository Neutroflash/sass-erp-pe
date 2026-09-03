import type { PrismaClient, Prisma } from "@prisma/client";
import { setTenantForTransaction } from "@/lib/tenant-rls";
import { slugify } from "@/lib/slugify";
import type { ImportedProduct } from "./import-products";

/**
 * Persiste un inventario ya validado por `parseInventoryCsv`.
 *
 * **Una sola transacción para todo el archivo.** Si algo falla en la fila 150, el negocio no puede
 * quedar con 149 productos a medio migrar y sin forma de saber dónde se cortó — eso es peor que un
 * import que falla entero, porque obliga a revisar el inventario a mano para saber qué reintentar.
 *
 * Separado de la ruta HTTP a propósito: es el único pedazo del import que toca la base, y el que
 * puede fallar por unicidad de slug/SKU en formas que solo se ven contra Postgres real.
 *
 * NO registra movimientos de kardex por el stock inicial — misma convención que
 * `POST /api/products`, donde crear un producto con stock tampoco genera un StockMovement. El
 * kardex arranca vacío y el primer movimiento es el primer ajuste o venta real.
 */
export async function saveImportedProducts(
  prisma: PrismaClient,
  tenantId: string,
  products: ImportedProduct[],
): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      await setTenantForTransaction(tx, tenantId);

      // Las categorías nombradas en el archivo se crean si no existen — pedirle al usuario que las
      // cree a mano antes de importar es exactamente la fricción que este import viene a quitar.
      const categoryNames = [...new Set(products.map((p) => p.categoryName).filter((n): n is string => !!n))];
      const categoryIdByName = new Map<string, string>();
      for (const name of categoryNames) {
        const slug = slugify(name);
        const category = await tx.category.upsert({
          where: { tenantId_slug: { tenantId, slug } },
          update: {},
          create: { tenantId, name, slug },
        });
        categoryIdByName.set(name.toLowerCase(), category.id);
      }

      // Los slugs ya usados se traen UNA vez y se desambigua en memoria: un SELECT por producto
      // para buscar colisiones serían 200 queries extra dentro de la transacción.
      const existingSlugs = new Set(
        (await tx.product.findMany({ where: { tenantId }, select: { slug: true } })).map((p) => p.slug),
      );

      for (const product of products) {
        const baseSlug = slugify(product.name);
        let slug = baseSlug;
        let suffix = 1;
        while (existingSlugs.has(slug)) {
          suffix += 1;
          slug = `${baseSlug}-${suffix}`;
        }
        existingSlugs.add(slug);

        await tx.product.create({
          data: {
            tenantId,
            name: product.name,
            slug,
            categoryId: product.categoryName ? categoryIdByName.get(product.categoryName.toLowerCase()) : undefined,
            variants: {
              create: product.variants.map((v) => ({
                tenantId,
                sku: v.sku,
                name: v.name,
                price: v.price,
                costPrice: v.costPrice,
                stock: v.stock,
                unitCode: v.unitCode,
                taxAffectationCode: v.taxAffectationCode,
                attributes: {} as Prisma.InputJsonValue,
              })),
            },
          },
        });
      }

      return products.length;
    },
    // Un archivo de 200 productos pasa holgado del default de 5s de Prisma.
    { timeout: 120_000, maxWait: 10_000 },
  );
}
