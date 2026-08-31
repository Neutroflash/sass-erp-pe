import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme-script";

export const metadata: Metadata = {
  title: "SaaS E-Commerce & ERP para Perú",
  description: "Plataforma multi-tenant de inventario, ventas y facturación electrónica para pymes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: el script inline de abajo puede quitar/mantener "dark" ANTES de
    // que React hidrate, así que la clase real del DOM puede no coincidir con este className del
    // primer render de React — es exactamente el caso para el que existe esta prop, no un parche
    // de un bug real.
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        {/* Script síncrono, no un módulo — debe correr antes del primer paint. Ver theme-script.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
