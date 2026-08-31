"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";

interface Props {
  businessName: string;
  logoUrl: string | null;
}

// Sin ícono de cuenta a propósito: la tienda pública de un tenant no tiene sistema de cuentas de
// cliente — el único login bajo /ingresar es para el staff del panel, y enlazarlo acá desde una
// vista de cliente final sería engañoso.
export function Navbar({ businessName, logoUrl }: Props) {
  const totalItems = useCartStore((state) => state.totalItems());
  const openCart = useCartStore((state) => state.openCart);

  return (
    <header className="sticky top-4 z-50 mx-4 sm:mx-auto sm:max-w-7xl sm:px-4">
      <div className="flex h-16 items-center gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 shadow-lg shadow-black/20 backdrop-blur-xl">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2">
          {logoUrl ? (
            <Image src={logoUrl} alt={businessName} width={32} height={32} unoptimized className="shrink-0 rounded-full" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {businessName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm font-bold text-zinc-100">{businessName}</span>
        </Link>

        <nav className="hidden gap-6 text-sm font-medium sm:flex">
          <Link href="/catalogo" className="text-zinc-400 transition-colors hover:text-primary">
            Catálogo
          </Link>
        </nav>

        <Button
          variant="outline"
          size="icon"
          className="relative ml-auto shrink-0 rounded-full"
          onClick={openCart}
          aria-label="Abrir carrito"
        >
          <ShoppingCart className="h-5 w-5" />
          {totalItems > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {totalItems}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
