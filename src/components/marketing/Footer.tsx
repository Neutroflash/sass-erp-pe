import Link from "next/link";

// Estático a propósito, a diferencia del Footer de la tienda de un tenant (components/storefront/Footer.tsx):
// FlashStock vende suscripciones B2B a negocios, no productos a consumidores finales — la obligación legal
// del Libro de Reclamaciones acá es mucho más débil/discutible que la de un tenant, así que esto es solo
// contenido fijo (sin folio/panel/email), no una réplica del sistema de reclamos de domain/complaints/.
export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold uppercase tracking-widest text-foreground">
            Flash<span className="text-yellow-400">Stock</span>
          </span>
          <p className="text-sm text-muted-foreground">Plataforma multi-tenant de inventario, ventas y facturación electrónica para pymes.</p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plataforma</h3>
          <Link href="/precios" className="text-sm text-muted-foreground hover:text-yellow-400">
            Precios
          </Link>
          <Link href="/registro" className="text-sm text-muted-foreground hover:text-yellow-400">
            Crear mi tienda
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legal</h3>
          <Link href="/libro-de-reclamaciones" className="text-sm text-muted-foreground hover:text-yellow-400">
            Libro de Reclamaciones
          </Link>
          <Link href="/terminos-y-condiciones" className="text-sm text-muted-foreground hover:text-yellow-400">
            Términos y Condiciones
          </Link>
          <Link href="/politica-de-privacidad" className="text-sm text-muted-foreground hover:text-yellow-400">
            Política de Privacidad
          </Link>
        </div>
      </div>

      <div className="border-t border-border/80 py-4 text-center text-xs text-muted-foreground/70">
        © {new Date().getFullYear()} FlashStock. Todos los derechos reservados.
      </div>
    </footer>
  );
}
