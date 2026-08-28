import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS E-Commerce & ERP para Perú",
  description: "Plataforma multi-tenant de inventario, ventas y facturación electrónica para pymes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
