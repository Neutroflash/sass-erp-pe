"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface Props {
  businessName: string;
  logoUrl: string | null;
}

// Sin ícono de cuenta ni link de "Pedidos" a propósito: la tienda pública de un tenant no tiene
// sistema de cuentas/historial de pedidos de cliente — el único login bajo /ingresar es para el
// staff del panel. Un link a algo que no existe sería peor que no tenerlo.
export function Navbar({ businessName, logoUrl }: Props) {
  const totalItems = useCartStore((state) => state.totalItems());
  const openCart = useCartStore((state) => state.openCart);

  return (
    <header className="sticky top-4 z-50 mx-4 sm:mx-auto sm:max-w-7xl sm:px-4">
      <div className="flex h-16 items-center gap-4 rounded-full border border-border bg-card/80 px-4 shadow-lg shadow-black/30 backdrop-blur-xl">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2.5">
          {logoUrl ? (
            <Image src={logoUrl} alt={businessName} width={32} height={32} unoptimized className="shrink-0 rounded-full" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {businessName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm font-bold text-foreground">{businessName}</span>
        </Link>

        <form
          method="GET"
          action="/catalogo"
          className="hidden flex-1 items-center justify-center px-2 lg:flex"
        >
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="search"
              placeholder="Buscar productos..."
              className="h-10 w-full rounded-full border border-border bg-accent pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
          </div>
        </form>

        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex lg:hidden">
          <Link href="/catalogo" className="text-muted-foreground transition-colors hover:text-primary">
            Catálogo
          </Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeToggle className="hidden sm:flex" />
          <Link
            href="/catalogo"
            aria-label="Buscar productos"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-accent text-foreground/90 transition-colors hover:border-primary/50 hover:text-primary lg:hidden"
          >
            <Search className="h-4 w-4" />
          </Link>

          <Button
            size="icon"
            className="relative rounded-full shadow-glow"
            onClick={openCart}
            aria-label="Abrir carrito"
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-black ring-2 ring-card">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
