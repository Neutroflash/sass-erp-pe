import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { parseInventoryCsv } from "./import-products";
import { saveImportedProducts } from "./save-imported-products";
import { toQty } from "./quantity";

/**
 * Contra Postgres real, mismo criterio que reserve-stock.test.ts: lo que puede fallar acá —
 * unicidad de slug por tenant, unicidad de SKU, la transacción entera revertida — solo se ve
 * contra una base de verdad. Un Prisma mockeado pasaría estos tests sin probar nada.
 *
 * El archivo que se importa es el MISMO `docs/ejemplos/inventario-demo.csv` que se le carga a un
 * negocio en una demo: si alguien lo edita y lo rompe, este test se cae.
 */
const setupClient = new PrismaClient();
let tenantId: string;

beforeAll(async () => {
  const tenant = await setupClient.tenant.create({
    data: { slug: `test-import-${Date.now()}`, businessName: "Test Import" },
  });
  tenantId = tenant.id;
});

afterAll(async () => {
  await setupClient.tenant.delete({ where: { id: tenantId } }); // cascade: productos, variantes, categorías
  await setupClient.$disconnect();
});

describe("saveImportedProducts — contra Postgres real", () => {
  test("importa el inventario de demostración completo, con sus variantes y categorías", async () => {
    const csv = readFileSync("docs/ejemplos/inventario-demo.csv", "utf8");
    const parsed = parseInventoryCsv(csv);

    expect(parsed.errors).toEqual([]);

    const created = await saveImportedProducts(prisma, tenantId, parsed.products);
    expect(created).toBe(parsed.products.length);

    const products = await setupClient.product.findMany({
      where: { tenantId },
      include: { variants: true, category: true },
    });
    expect(products).toHaveLength(parsed.products.length);

    // Las categorías nombradas en el CSV se crearon solas, sin pedírselas al usuario primero.
    const categories = await setupClient.category.findMany({ where: { tenantId } });
    expect(categories.map((c) => c.name).sort()).toEqual(["Avíos", "Confección", "Insumos", "Telas"]);

    // La respuesta a la pregunta del cliente: los estampados son variantes de UN producto.
    const estampada = products.find((p) => p.name === "Tela toalla estampada");
    expect(estampada?.variants).toHaveLength(3);
    expect(estampada?.category?.name).toBe("Telas");

    // Metros con decimales, no unidades enteras.
    const algodon = products.find((p) => p.name === "Algodón llano");
    expect(algodon?.variants[0].unitCode).toBe("MTR");
    expect(toQty(algodon!.variants[0].stock)).toBe(145.5);
  });

  test("reimportar el mismo archivo no duplica slugs: los desambigua", async () => {
    // Un negocio que importa dos veces por error no debe romper la unicidad (tenantId, slug).
    // Los SKU sí chocarían, pero eso lo bloquea la ruta antes de llegar acá — este test cubre que
    // la desambiguación de slug funcione contra la base, no contra un Set en memoria.
    const parsed = parseInventoryCsv(readFileSync("docs/ejemplos/inventario-demo.csv", "utf8"));
    const soloUno = parsed.products.slice(0, 1).map((p) => ({
      ...p,
      variants: p.variants.map((v) => ({ ...v, sku: `${v.sku}-DUP` })),
    }));

    await saveImportedProducts(prisma, tenantId, soloUno);

    const conMismoNombre = await setupClient.product.findMany({
      where: { tenantId, name: soloUno[0].name },
      select: { slug: true },
    });
    expect(conMismoNombre).toHaveLength(2);
    expect(new Set(conMismoNombre.map((p) => p.slug)).size).toBe(2);
  });

  test("si una fila viola una restricción, no queda NADA a medio importar", async () => {
    const before = await setupClient.product.count({ where: { tenantId } });

    // Dos productos, el segundo con un SKU que ya existe: la transacción entera debe revertirse.
    const existing = await setupClient.productVariant.findFirst({ where: { tenantId }, select: { sku: true } });
    const conflictivo = [
      { name: "Producto nuevo A", variants: [{ sku: "IMPORT-OK-1", name: "A", price: 10, costPrice: 5, stock: 1, unitCode: "NIU", taxAffectationCode: "10" }] },
      { name: "Producto nuevo B", variants: [{ sku: existing!.sku, name: "B", price: 10, costPrice: 5, stock: 1, unitCode: "NIU", taxAffectationCode: "10" }] },
    ];

    await expect(saveImportedProducts(prisma, tenantId, conflictivo)).rejects.toThrow();

    // Ni siquiera el primero, que era válido, quedó cargado.
    const after = await setupClient.product.count({ where: { tenantId } });
    expect(after).toBe(before);
    expect(await setupClient.productVariant.count({ where: { tenantId, sku: "IMPORT-OK-1" } })).toBe(0);
  });
});
