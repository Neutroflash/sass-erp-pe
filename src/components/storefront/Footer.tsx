import Link from "next/link";
import { MapPin, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buildWhatsAppLink } from "@/lib/whatsapp";

interface Props {
  tenantId: string;
  businessName: string;
  izipayEnabled: boolean;
  fiscalAddress: string | null;
  whatsappNumber: string | null;
}

// A diferencia del footer de Flashkings, no hay métodos de pago hardcodeados: cada tenant tiene
// los suyos propios (Izipay opcional, o cobro manual Yape/Plin/efectivo fuera de la plataforma) —
// la columna solo aparece si el tenant configuró Izipay de verdad. Mismo criterio para el contacto:
// WhatsApp/dirección solo aparecen si el negocio los configuró en Configuración.
export async function Footer({ tenantId, businessName, izipayEnabled, fiscalAddress, whatsappNumber }: Props) {
  const categories = await prisma.category.findMany({
    where: { tenantId },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take: 8,
  });

  return (
    <footer className="mt-24 border-t border-white/10 bg-black/40">
      <div className={`mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 ${izipayEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <div className="flex flex-col gap-3">
          <span className="text-lg font-bold text-zinc-100">{businessName}</span>
          <p className="text-sm text-zinc-400">Tienda en línea — pedidos, catálogo y atención directa.</p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Categorías</h3>
          <ul className="flex flex-col gap-2 text-sm text-zinc-400">
            {categories.length > 0 ? (
              categories.map((category) => (
                <li key={category.id}>
                  <Link href={`/catalogo?category=${category.slug}`} className="hover:text-primary">
                    {category.name}
                  </Link>
                </li>
              ))
            ) : (
              <li>
                <Link href="/catalogo" className="hover:text-primary">
                  Ver catálogo
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Ayuda</h3>
          <ul className="flex flex-col gap-2 text-sm text-zinc-400">
            <li>
              <Link href="/catalogo" className="hover:text-primary">
                Catálogo completo
              </Link>
            </li>
            <li>
              <Link href="/libro-de-reclamaciones" className="hover:text-primary">
                Libro de Reclamaciones
              </Link>
            </li>
            <li>
              <Link href="/terminos-y-condiciones" className="hover:text-primary">
                Términos y Condiciones
              </Link>
            </li>
            <li>
              <Link href="/politica-de-privacidad" className="hover:text-primary">
                Política de Privacidad
              </Link>
            </li>
            {whatsappNumber && (
              <li>
                <a
                  href={buildWhatsAppLink(whatsappNumber, `Hola ${businessName}, tengo una consulta.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-primary"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Escríbenos por WhatsApp
                </a>
              </li>
            )}
            {fiscalAddress && (
              <li className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {fiscalAddress}
              </li>
            )}
          </ul>
        </div>

        {izipayEnabled && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Métodos de pago</h3>
            <div className="flex flex-wrap gap-2">
              {["Tarjeta", "Yape", "Plin"].map((method) => (
                <span
                  key={method}
                  className="rounded-md border border-white/10 bg-card/60 px-2.5 py-1 text-xs font-medium text-zinc-300"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-zinc-600">
        <p>
          © {new Date().getFullYear()} {businessName}. Todos los derechos reservados.
        </p>
        <p className="mt-1 text-zinc-700">Tienda impulsada por FlashStock</p>
      </div>
    </footer>
  );
}
