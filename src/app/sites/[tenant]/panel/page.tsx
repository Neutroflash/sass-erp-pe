import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  LayoutGrid,
  MessageSquareWarning,
  Package,
  Receipt,
  ShoppingCart,
  Sliders,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentTenantUser } from "@/lib/auth";
import { getTenantFeatures } from "@/lib/features";
import { prisma } from "@/lib/prisma";
import { withTenantRLS } from "@/lib/tenant-rls";
import { cn, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/panel/reportes/KpiCard";
import { STATUS_LABEL, STATUS_BADGE_VARIANT } from "@/domain/orders/order-status";
import { lineTotal } from "@/domain/inventory/quantity";

// Nunca estática — cada tarjeta refleja el estado del negocio en este momento.
export const dynamic = "force-dynamic";

// Umbral de "stock bajo" fijo por ahora — candidato obvio a ser un campo configurable por tenant
// (o por producto) en cuanto el negocio piloto lo pida; no vale la pena esa flexibilidad todavía.
const LOW_STOCK_THRESHOLD = 5;
const RECENT_ORDERS_LIMIT = 5;

interface QuickLink {
  href: string;
  label: string;
  description: string;
  icon: typeof LayoutGrid;
  feature?: keyof Awaited<ReturnType<typeof getTenantFeatures>>;
  ownerOnly?: boolean;
}

const QUICK_LINKS: QuickLink[] = [
  { href: "/panel/inventario", label: "Inventario", description: "Productos y stock", icon: Package, feature: "inventoryManagement" },
  { href: "/panel/kardex", label: "Kardex", description: "Movimientos de stock", icon: Warehouse, feature: "inventoryManagement" },
  { href: "/panel/pedidos", label: "Pedidos", description: "Validar pagos y envíos", icon: ShoppingCart, feature: "orderValidation" },
  { href: "/panel/pos", label: "Punto de venta", description: "Vender presencial", icon: ShoppingCart, feature: "posWeb" },
  { href: "/panel/facturacion", label: "Facturación SUNAT", description: "Boletas y facturas", icon: Receipt, feature: "sunatInvoicing" },
  { href: "/panel/reportes", label: "Reportes", description: "Ventas y KPIs", icon: BarChart3, ownerOnly: true },
];

export default async function TenantDashboardPage() {
  const tenant = await getCurrentTenant();
  const [user, features] = await Promise.all([getCurrentTenantUser(tenant.id), getTenantFeatures(tenant.id)]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const showRecentOrders = features.orderValidation || features.posWeb;

  // Cada query condicionada a su propio feature — no tiene sentido pagar el costo de una consulta
  // (ni mostrar el dato) de un módulo que este negocio no tiene activo.
  const [salesToday, pendingValidations, todaysMargin, lowStockCount, recentOrders] = await Promise.all([
    showRecentOrders
      ? withTenantRLS(prisma, tenant.id, (tx) => tx.order.count({ where: { tenantId: tenant.id, createdAt: { gte: startOfToday } } }))
      : null,
    features.orderValidation
      ? withTenantRLS(prisma, tenant.id, (tx) => tx.order.count({ where: { tenantId: tenant.id, status: "PENDING_PAYMENT" } }))
      : null,
    features.profitMargins
      ? withTenantRLS(prisma, tenant.id, (tx) =>
          tx.orderItem.findMany({
            where: { order: { tenantId: tenant.id, createdAt: { gte: startOfToday }, status: { not: "CANCELLED" } } },
            select: { quantity: true, price: true, variant: { select: { costPrice: true } } },
          }),
        )
      : null,
    features.inventoryManagement
      ? withTenantRLS(prisma, tenant.id, (tx) => tx.productVariant.count({ where: { tenantId: tenant.id, stock: { lte: LOW_STOCK_THRESHOLD } } }))
      : null,
    showRecentOrders
      ? withTenantRLS(prisma, tenant.id, (tx) =>
          tx.order.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: RECENT_ORDERS_LIMIT }),
        )
      : null,
  ]);

  const marginTotal = todaysMargin?.reduce(
    (sum, item) => sum + lineTotal(item.quantity, Number(item.price) - Number(item.variant.costPrice)),
    0,
  );

  const visibleLinks = QUICK_LINKS.filter((link) => (!link.feature || features[link.feature]) && (!link.ownerOnly || user?.role === "OWNER"));
  const today = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{tenant.businessName}</h1>
        <p className="text-sm capitalize text-muted-foreground">{today}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {salesToday !== null && (
          <KpiCard label="Ventas del día" value={String(salesToday)} sublabel="pedidos creados hoy" icon={<ShoppingCart className="h-4 w-4" />} />
        )}
        {pendingValidations !== null && (
          <KpiCard
            label="Validaciones pendientes"
            value={String(pendingValidations)}
            sublabel="Yape / Plin por confirmar"
            icon={<Clock className="h-4 w-4" />}
          />
        )}
        {marginTotal !== undefined && (
          <KpiCard
            label="Margen de ganancia neto"
            value={formatPrice(marginTotal ?? 0)}
            sublabel="hoy, órdenes no canceladas"
            icon={<TrendingUp className="h-4 w-4" />}
          />
        )}
        {lowStockCount !== null && (
          <KpiCard
            label="Alertas de stock bajo"
            value={String(lowStockCount)}
            sublabel={`variantes con ≤ ${LOW_STOCK_THRESHOLD} unidades`}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        )}
      </div>

      {visibleLinks.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Accesos rápidos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleLinks.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card/60 p-4 backdrop-blur-md transition-colors hover:border-primary/50 hover:bg-card"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </div>
              </Link>
            ))}
            {user?.role === "OWNER" && (
              <Link
                href="/panel/configuracion"
                className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card/60 p-4 backdrop-blur-md transition-colors hover:border-primary/50 hover:bg-card"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Sliders className="h-5 w-5" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">Configuración</span>
                  <span className="text-xs text-muted-foreground">Datos del negocio y módulos</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {recentOrders !== null && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Pedidos recientes</h2>
            <Link href="/panel/pedidos" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="rounded-2xl border border-border/80 bg-card/60 p-5 text-sm text-muted-foreground backdrop-blur-md">
              Todavía no hay pedidos.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md">
              {recentOrders.map((order, i) => (
                <Link
                  key={order.id}
                  href={`/panel/pedidos/${order.id}`}
                  className={cn("flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent", i > 0 && "border-t border-border/60")}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground/90">{order.customerName}</span>
                    <span className="text-xs text-muted-foreground">{order.createdAt.toLocaleString("es-PE")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-primary">{formatPrice(Number(order.totalAmount))}</span>
                    <Badge variant={STATUS_BADGE_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {!showRecentOrders && !features.inventoryManagement && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
          <MessageSquareWarning className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Todavía no tenés módulos activos. Escribinos si querés habilitar inventario, pedidos u otro módulo.
          </p>
        </div>
      )}
    </div>
  );
}
