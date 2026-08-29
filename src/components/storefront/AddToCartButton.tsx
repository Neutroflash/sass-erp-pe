"use client";

import { useRouter } from "next/navigation";
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

export function AddToCartButton({ variantId, productSlug, productName, variantName, price, inStock }: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  return (
    <Button
      size="sm"
      disabled={!inStock}
      onClick={() => {
        addItem({ variantId, productSlug, productName, variantName, price });
        router.push("/checkout");
      }}
    >
      {inStock ? "Comprar" : "Agotado"}
    </Button>
  );
}
