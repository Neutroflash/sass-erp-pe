import type { OrderStatus } from "@prisma/client";

// Módulo puro (sin "use client"): estas etiquetas las consumen tanto columns.tsx (cliente, para la
// tabla de Pedidos) como el dashboard del panel (Server Component). Definirlas dentro de
// pedidos/columns.tsx y re-exportarlas desde ahí rompía el bundler de RSC — un Server Component no
// puede leer un valor de un módulo "use client" e interpolarlo directo en su propio render
// ("Could not find the module ... in the React Client Manifest").
export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PENDING_COLLECTION: "Por cobrar",
  PAID: "Pagado",
  IN_PREPARATION: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const STATUS_BADGE_VARIANT: Record<OrderStatus, "success" | "warning" | "destructive" | "outline"> = {
  PENDING_PAYMENT: "outline",
  // Ámbar, no verde: la mercadería salió pero la plata no entró. Verlo en verde junto a las
  // ventas cobradas es exactamente la confusión que este estado existe para evitar.
  PENDING_COLLECTION: "warning",
  PAID: "success",
  IN_PREPARATION: "success",
  SHIPPED: "success",
  DELIVERED: "success",
  CANCELLED: "destructive",
};
