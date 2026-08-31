import type { Metadata } from "next";

export const metadata: Metadata = { title: "Libro de Reclamaciones | FlashStock" };

const REQUIRED_FIELDS = [
  "Nombre completo y N° de documento (DNI/CE/pasaporte)",
  "Dirección y correo electrónico de contacto",
  "Servicio contratado (plan, fecha de registro/cobro)",
  "Detalle del reclamo o queja",
  "Pedido concreto — qué solicitas a FlashStock",
];

// Página estática, sin formulario/backend propio — a diferencia del Libro de Reclamaciones de un
// tenant (domain/complaints/, con folio/panel/email automático), acá el canal es un correo
// directo: FlashStock es un proveedor B2B (vende suscripciones a negocios, no productos a
// consumidores finales), la obligación es más débil, y replicar el sistema completo del tenant
// para este único caso no se justifica. Ver el comentario en components/marketing/Footer.tsx.
export default function LibroDeReclamacionesPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Libro de Reclamaciones</h1>
      <div className="flex flex-col gap-5 text-sm leading-relaxed text-muted-foreground">
        <p>
          Conforme al Código de Protección y Defensa del Consumidor (Ley N° 29571), <strong className="text-foreground">FlashStock</strong>{" "}
          pone a tu disposición este canal para presentar un reclamo (disconformidad con el servicio) o una queja (disconformidad
          con la atención).
        </p>

        <div>
          <h2 className="mb-2 font-semibold text-foreground">Cómo presentar tu reclamo</h2>
          <p className="mb-3">
            Escríbenos a{" "}
            <a
              href="mailto:reclamos@flashstock.pe?subject=Reclamo%20-%20Libro%20de%20Reclamaciones"
              className="font-medium text-yellow-400 hover:underline"
            >
              reclamos@flashstock.pe
            </a>{" "}
            incluyendo:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {REQUIRED_FIELDS.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-foreground">Plazo de respuesta</h2>
          <p>Te responderemos dentro de los 30 días calendario que establece la norma, conservando tu correo como constancia de presentación.</p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-foreground">¿Buscas reclamar sobre una compra en una tienda de FlashStock?</h2>
          <p>
            Si tu reclamo es sobre un producto o servicio comprado en la tienda de un negocio que usa FlashStock (no sobre
            FlashStock como plataforma), contacta directamente a ese negocio — cada tienda tiene su propio Libro de
            Reclamaciones en <code className="rounded bg-input px-1 py-0.5 text-xs">/libro-de-reclamaciones</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
