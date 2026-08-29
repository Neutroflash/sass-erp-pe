import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  variantId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

// Carrito por navegador, no por tenant explícitamente en la clave de storage — cada subdominio
// de tenant ya es un origen distinto para localStorage, así que el aislamiento viene gratis del
// propio navegador (el carrito de negocio-a.tusaas.pe nunca es visible desde negocio-b.tusaas.pe).
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return { items: state.items.map((i) => (i.variantId === item.variantId ? { ...i, quantity: i.quantity + quantity } : i)) };
          }
          return { items: [...state.items, { ...item, quantity }] };
        }),
      removeItem: (variantId) => set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      setQuantity: (variantId, quantity) =>
        set((state) => ({ items: state.items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)) })),
      clear: () => set({ items: [] }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "cart-storage",
      // skipHydration + rehidratación manual en un componente montado una sola vez
      // (CartHydration) — sin esto, el store se rehidrata sincrónicamente desde localStorage
      // ANTES del primer render del cliente, mientras el HTML del servidor (que no conoce
      // localStorage) ya se pintó vacío — mismatch de hidratación de React. Bug real ya
      // encontrado y corregido una vez en Flashkings; se evita acá desde el principio.
      skipHydration: true,
    },
  ),
);
