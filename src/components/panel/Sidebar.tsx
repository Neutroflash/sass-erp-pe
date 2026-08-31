"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutGrid, MessageSquareWarning, Package, Receipt, ShoppingCart, Sliders, Warehouse } from "lucide-react";
import type { TenantFeatures } from "@/domain/tenant-features";
import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./LogoutButton";

interface NavLink {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  /** undefined = siempre visible (dashboard, configuración) — no todo link depende de un módulo. */
  feature?: keyof TenantFeatures;
  /** true = solo OWNER (además del filtro de `feature`, si tiene uno) — ver Fase 4, roles más finos. */
  ownerOnly?: boolean;
}

// El orden acá es el orden en pantalla. "Dashboard" y "Configuración" no tienen `feature`: todo
// negocio los ve, sin importar qué módulos tenga activos.
const LINKS: NavLink[] = [
  { href: "/panel", label: "Dashboard", icon: LayoutGrid },
  { href: "/panel/inventario", label: "Inventario", icon: Package, feature: "inventoryManagement" },
  { href: "/panel/kardex", label: "Kardex", icon: Warehouse, feature: "inventoryManagement" },
  { href: "/panel/pedidos", label: "Pedidos", icon: ShoppingCart, feature: "orderValidation" },
  { href: "/panel/pos", label: "Punto de venta", icon: ShoppingCart, feature: "posWeb" },
  { href: "/panel/facturacion", label: "Facturación SUNAT", icon: Receipt, feature: "sunatInvoicing" },
  { href: "/panel/reportes", label: "Reportes", icon: BarChart3, ownerOnly: true },
  { href: "/panel/reclamos", label: "Reclamos", icon: MessageSquareWarning, ownerOnly: true },
  { href: "/panel/configuracion", label: "Configuración", icon: Sliders, ownerOnly: true },
];

// Mismo lenguaje visual que el panel admin de Flashkings (ver ADMIN_DESIGN_SYSTEM.md en ese
// repo): tarjeta glassmorphism, acento dorado en el ítem activo, denso y sin animación.
export function Sidebar({ features, role }: { features: TenantFeatures; role: UserRole }) {
  const pathname = usePathname();
  // El link de un módulo desactivado (o restringido a OWNER, para un SELLER) simplemente no se
  // renderiza — no aparece tachado ni deshabilitado, desaparece. El guard real sigue viviendo en
  // la ruta (feature-guards.ts / el redirect de cada page.tsx OWNER-only); esto es solo no ofrecer
  // un camino a algo que la ruta va a rechazar de todas formas.
  const visibleLinks = LINKS.filter((link) => (!link.feature || features[link.feature]) && (!link.ownerOnly || role === "OWNER"));

  return (
    <nav className="flex h-fit flex-col gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 backdrop-blur-md">
      <span className="mb-2 px-3 text-xs font-semibold uppercase tracking-widest text-primary/80">
        Panel de gestión
      </span>
      {visibleLinks.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/panel" && pathname?.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary/10 text-primary" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
      <hr className="my-2 border-zinc-800/80" />
      <LogoutButton />
    </nav>
  );
}
