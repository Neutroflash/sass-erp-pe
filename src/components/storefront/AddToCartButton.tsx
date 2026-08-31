"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { Button } from "@/components/ui/button";

interface Props {
  variantId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  price: number;
  inStock: boolean;
}

// Agrega y abre el drawer en vez de ir directo a /checkout — deja al cliente revisar/ajustar
// cantidades antes de pagar, consistente con el nuevo CartDrawer.
export function AddToCartButton({ variantId, productSlug, productName, variantName, price, inStock }: Props) {
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  return (
    <Button
      size="sm"
      disabled={!inStock}
      onClick={() => {
        addItem({ variantId, productSlug, productName, variantName, price });
        openCart();
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
    >
      {!inStock ? "Agotado" : added ? (
        <>
          <Check className="h-3.5 w-3.5" /> Agregado
        </>
      ) : (
        "Agregar al carrito"
      )}
    </Button>
  );
}
