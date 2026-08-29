"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart-store";

// Montado una sola vez en el layout del tenant — ver el comentario en cart-store.ts sobre por qué
// skipHydration + rehidratación manual acá, en vez de la rehidratación automática por defecto.
export function CartHydration() {
  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);
  return null;
}
