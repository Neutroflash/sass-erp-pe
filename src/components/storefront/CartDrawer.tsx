"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

// A diferencia del drawer de Flashkings, no llama a un endpoint de validate-cart antes de ir a
// /checkout — ese endpoint no existe acá. El 409 por falta de stock (si la carrera se pierde justo
// al crear el pedido) ya lo maneja CheckoutClient.tsx mostrando el error, sin salir del flujo.
export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, setQuantity, totalPrice } = useCartStore();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xs flex-col border-l border-white/10 bg-neutral-950">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <Dialog.Title className="flex items-center gap-2 text-lg font-bold text-zinc-100">
              <ShoppingCart className="h-5 w-5" /> Tu carrito
            </Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Cerrar carrito" className="text-zinc-400 hover:text-zinc-100">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <p className="mt-10 text-center text-zinc-500">Tu carrito está vacío.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <li key={item.variantId} className="flex gap-3 border-b border-white/10 pb-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-zinc-100">{item.productName}</span>
                      <span className="text-xs text-zinc-500">{item.variantName}</span>
                      <div className="mt-1 flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1 py-1 w-fit">
                        <button
                          onClick={() => setQuantity(item.variantId, Math.max(1, item.quantity - 1))}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-primary"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-medium text-zinc-200">{item.quantity}</span>
                        <button
                          onClick={() => setQuantity(item.variantId, item.quantity + 1)}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 hover:text-primary"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <span className="text-sm font-semibold text-zinc-100">{formatPrice(item.price * item.quantity)}</span>
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-xs text-zinc-500 hover:text-destructive"
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <div className="border-t border-white/10 p-4">
              <div className="mb-4 flex items-center justify-between text-lg font-bold text-zinc-100">
                <span>Subtotal</span>
                <span className="text-primary">{formatPrice(totalPrice())}</span>
              </div>
              <Dialog.Close asChild>
                <Link href="/checkout">
                  <Button size="md" className="w-full">
                    Continuar con la compra
                  </Button>
                </Link>
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
