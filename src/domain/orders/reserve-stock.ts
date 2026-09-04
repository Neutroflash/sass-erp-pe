import type { OrderChannel, Prisma } from "@prisma/client";
import { InsufficientStockError } from "./errors";
import { setTenantForTransaction } from "@/lib/tenant-rls";
import { formatQty, hasEnough, lineTotal, subQty, toParam, toQty } from "@/domain/inventory/quantity";
import { unitShort } from "@/domain/inventory/units";

export interface CartLineInput {
  variantId: string;
  quantity: number;
}

export interface CreateOrderParams {
  tenantId: string;
  userId: string | null;
  channel: OrderChannel;
  /** Ficha del cliente del negocio. Ausente en toda venta online de invitado. */
  customerId?: string | null;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  items: CartLineInput[];
}

export interface CreateOrderResult {
  orderId: string;
  totalAmount: number;
}

interface LockedVariantRow {
  id: string;
  // `numeric` llega como string desde $queryRaw crudo, igual que `price` — los helpers de
  // quantity.ts lo normalizan. Tiparlos como number invitaría a restarlos directamente.
  stock: string;
  reserved_stock: string;
  price: string;
  unit_code: string;
}

/**
 * Postgres row-locking es el límite real de corrección acá — no un contador en Redis, que
 * crearía una segunda fuente de verdad que reconciliar en cada modo de fallo. Con un solo
 * Postgres, un lock de fila resuelve la concurrencia sobre la última unidad de forma simple.
 * Debe correr DENTRO de una transacción abierta por el caller (`tx`), nunca abre la suya propia
 * — así el caller decide el alcance exacto de qué más entra en el mismo commit/rollback.
 */
export async function createOrderWithStockReservation(
  tx: Prisma.TransactionClient,
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  if (params.items.length === 0) {
    throw new InsufficientStockError("El carrito está vacío");
  }

  // RLS (ver docs/RLS.md): fija app.tenant_id para el resto de esta transacción, sin importar
  // qué caller la abrió (checkout online u orders/route.ts, POS vía create-pos-sale.ts).
  await setTenantForTransaction(tx, params.tenantId);

  // Orden estable por variantId — evita deadlocks entre dos checkouts concurrentes que reservan
  // las mismas variantes en orden distinto (si A bloquea 1-luego-2 mientras B bloquea 2-luego-1,
  // Postgres eventualmente mata a uno por deadlock; ordenando ambos igual, nunca compiten en
  // direcciones opuestas).
  const sortedItems = [...params.items].sort((a, b) => a.variantId.localeCompare(b.variantId));

  let totalAmount = 0;
  const frozenItems: { variantId: string; quantity: number; price: number }[] = [];

  for (const item of sortedItems) {
    // tenant_id en el WHERE del lock, no solo validado después — así el lock de fila también
    // confirma que la variante es de ESTE negocio, no solo que existe.
    const rows = await tx.$queryRaw<LockedVariantRow[]>`
      SELECT id, stock, reserved_stock, price, unit_code FROM product_variants
      WHERE id = ${item.variantId} AND tenant_id = ${params.tenantId}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new InsufficientStockError(`Producto no encontrado`);
    }

    const available = subQty(row.stock, row.reserved_stock);
    if (!hasEnough(available, item.quantity)) {
      throw new InsufficientStockError(
        `Stock insuficiente (disponible: ${formatQty(available)} ${unitShort(row.unit_code)})`,
      );
    }

    // `::numeric` sobre el literal decimal: un number de JS viaja como double precision y
    // sumarlo a una columna numeric metería el resultado por punto flotante antes de guardarlo.
    await tx.$executeRaw`
      UPDATE product_variants
      SET reserved_stock = reserved_stock + ${toParam(item.quantity)}::numeric, updated_at = now()
      WHERE id = ${item.variantId}
    `;

    const price = Number(row.price);
    const quantity = toQty(item.quantity);
    totalAmount = Math.round((totalAmount + lineTotal(quantity, price)) * 100) / 100;
    frozenItems.push({ variantId: item.variantId, quantity, price });
  }

  const order = await tx.order.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      channel: params.channel,
      totalAmount,
      customerId: params.customerId ?? null,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      shippingAddress: params.shippingAddress,
      items: { create: frozenItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity, price: i.price })) },
    },
  });

  return { orderId: order.id, totalAmount };
}
