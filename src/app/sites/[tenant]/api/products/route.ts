import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { requireTenantOwner } from "@/lib/api-guards";
import { slugify } from "@/lib/slugify";
import { toPublicProduct } from "@/domain/inventory/product";
import { resolvePlanLimits } from "@/domain/plan-limits";

const productInclude = { variants: true, images: true } satisfies Prisma.ProductInclude;

const listQuerySchema = z.object({
  category: z.string().optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  search: z.string().optional(),
});

// Público — la tienda de este tenant lo consume sin sesión. Solo si quien pregunta es el OWNER de
// este mismo tenant devuelve la forma completa (con costPrice) — un SELLER, aunque sea staff, no
// ve costos ni margen (ver Fase 4 del roadmap, "roles más finos"); a cualquier otro consumidor
// (SELLER, cliente final, anónimo) se le sanitiza — mismo patrón "sanitizar en la frontera" que
// Flashkings, ver toPublicProduct().
export async function GET(req: NextRequest) {
  const tenant = await getCurrentTenant();
  const query = listQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  const where: Prisma.ProductWhereInput = {
    tenantId: tenant.id,
    ...(query.category ? { category: { slug: query.category } } : {}),
    ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    ...(query.search
      ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { brand: { contains: query.search, mode: "insensitive" } }] }
      : {}),
  };

  const products = await prisma.product.findMany({ where, include: productInclude, orderBy: { createdAt: "desc" } });

  const user = await getCurrentTenantUser();
  const isOwner = user && user.tenantId === tenant.id && user.role === "OWNER";

  return NextResponse.json({
    items: isOwner
      ? products.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v, price: Number(v.price), costPrice: Number(v.costPrice) })) }))
      : products.map(toPublicProduct),
  });
}

const variantSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  price: z.number().positive(),
  costPrice: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  attributes: z.record(z.unknown()).optional(),
});

const createProductSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  brand: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isFeatured: z.boolean().optional(),
  variants: z.array(variantSchema).min(1),
});

export async function POST(req: NextRequest) {
  // OWNER-only: crear un producto fija su costPrice inicial — una decisión de margen, no una
  // operación de piso de venta (ver Fase 4 del roadmap, "roles más finos"). Un SELLER sigue
  // pudiendo editar precio/stock de lo ya creado (ver PATCH .../variants/[id]).
  const auth = await requireTenantOwner();
  if (auth instanceof NextResponse) return auth;

  const parsed = createProductSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de entrada inválidos", details: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: auth.tenantId },
    select: { planTier: true, planProductLimit: true, planInvoiceLimit: true },
  });
  const { productLimit } = resolvePlanLimits(tenant);
  if (productLimit !== null) {
    const currentCount = await prisma.product.count({ where: { tenantId: auth.tenantId } });
    if (currentCount >= productLimit) {
      return NextResponse.json(
        { error: `Alcanzaste el límite de ${productLimit} productos de tu plan (${tenant.planTier}). Sube de plan para agregar más.` },
        { status: 409 },
      );
    }
  }

  if (input.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, tenantId: auth.tenantId } });
    if (!category) {
      return NextResponse.json({ error: "La categoría especificada no existe" }, { status: 404 });
    }
  }

  const baseSlug = slugify(input.name);
  let slug = baseSlug;
  let suffix = 1;
  // El slug es único por tenant, no globalmente — dos negocios distintos pueden vender ambos un
  // "Mouse Gaming X". Solo dentro de un mismo negocio hay que desambiguar con un sufijo.
  while (await prisma.product.findUnique({ where: { tenantId_slug: { tenantId: auth.tenantId, slug } } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  // SKU también es único por tenant (ver @@unique([tenantId, sku]) en el schema) — validar antes
  // de intentar el create evita depender de que Postgres devuelva el error de constraint crudo.
  const skus = input.variants.map((v) => v.sku);
  const existingSku = await prisma.productVariant.findFirst({ where: { tenantId: auth.tenantId, sku: { in: skus } } });
  if (existingSku) {
    return NextResponse.json({ error: `El SKU "${existingSku.sku}" ya existe en este negocio` }, { status: 409 });
  }

  const product = await prisma.product.create({
    data: {
      tenantId: auth.tenantId,
      name: input.name,
      slug,
      description: input.description,
      brand: input.brand,
      categoryId: input.categoryId,
      isFeatured: input.isFeatured ?? false,
      variants: {
        create: input.variants.map((v) => ({
          tenantId: auth.tenantId,
          sku: v.sku,
          name: v.name,
          price: v.price,
          costPrice: v.costPrice,
          stock: v.stock,
          attributes: (v.attributes ?? {}) as Prisma.InputJsonValue,
        })),
      },
    },
    include: productInclude,
  });

  // Todo producto nuevo con stock inicial > 0 arranca con un movimiento de kardex tipo IN — el
  // historial de "de dónde salió el stock" empieza desde el primer día, nunca desde cero sin rastro.
  const initialStockEntries = product.variants.filter((v) => v.stock > 0);
  if (initialStockEntries.length > 0) {
    await prisma.stockMovement.createMany({
      data: initialStockEntries.map((v) => ({
        tenantId: auth.tenantId,
        variantId: v.id,
        type: "IN" as const,
        quantity: v.stock,
        reason: "Stock inicial al crear el producto",
        createdById: auth.user.id,
      })),
    });
  }

  return NextResponse.json({ product }, { status: 201 });
}
