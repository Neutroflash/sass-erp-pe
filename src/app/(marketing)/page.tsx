import Link from "next/link";
import { BarChart3, Receipt, ShoppingCart, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";

const MODULES = [
  { icon: Warehouse, title: "Inventario y kardex", desc: "Productos, variantes, stock y el historial completo de cada movimiento." },
  { icon: ShoppingCart, title: "Tienda online + POS", desc: "Vende por internet con reserva de stock, o presencial desde el mostrador." },
  { icon: Receipt, title: "Facturación SUNAT", desc: "Boletas y facturas electrónicas, con correlativo propio por negocio." },
  { icon: BarChart3, title: "Reportes", desc: "Ventas por período, productos más vendidos, valorización de inventario." },
];

// Landing pública del SaaS (tusaas.pe) — no confundir con la tienda de un tenant, que vive bajo
// el route group (tenant) y se resuelve por subdominio/dominio propio (ver middleware.ts).
export default function MarketingHomePage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 py-24 text-center">
        <span className="mb-4 inline-block text-xs uppercase tracking-widest text-yellow-400/80">
          Multi-tenant · e-commerce + ERP
        </span>
        <h1 className="mb-4 text-4xl font-bold text-zinc-100 sm:text-5xl">
          Vende, gestiona inventario y factura — todo en un panel
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-zinc-400">
          Una plataforma pensada para pymes en Perú: tienda en línea, punto de venta presencial, control de stock y
          facturación electrónica SUNAT. Activa solo los módulos que tu negocio necesita.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/registro">
            <Button>Crear mi tienda gratis</Button>
          </Link>
          <Link href="/precios">
            <Button variant="outline">Ver planes</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
              <Icon className="mb-3 h-6 w-6 text-yellow-400" />
              <h2 className="mb-1 font-semibold text-zinc-100">{title}</h2>
              <p className="text-sm text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
