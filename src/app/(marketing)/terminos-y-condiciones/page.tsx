import type { Metadata } from "next";

export const metadata: Metadata = { title: "Términos y Condiciones | FlashStock" };

// Estático — ver el comentario en components/marketing/Footer.tsx sobre por qué esto no replica
// el sistema tenant-por-tenant (domain/legal/templates.ts): FlashStock es un solo proveedor
// (B2B), no hay "un tenant" cuyos datos interpolar acá.
export default function TerminosPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Términos y Condiciones</h1>
      <div className="flex flex-col gap-5 text-sm leading-relaxed text-zinc-400">
        <p>
          Estos Términos y Condiciones regulan el uso de <strong className="text-zinc-200">FlashStock</strong>, una plataforma SaaS
          de inventario, ventas y facturación electrónica para pymes en Perú, operada como servicio de suscripción para negocios
          ("el Cliente" o "el Negocio").
        </p>

        <div>
          <h2 className="mb-1 font-semibold text-zinc-200">1. Objeto del servicio</h2>
          <p>
            FlashStock provee al Negocio un panel de administración, tienda en línea, punto de venta e integración con SUNAT para
            la emisión de comprobantes electrónicos, bajo un modelo de suscripción mensual según el plan contratado.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-zinc-200">2. Planes y pagos</h2>
          <p>
            Los precios y límites de cada plan (Gratis, Starter, Pro) están publicados en{" "}
            <a href="/precios" className="text-yellow-400 hover:underline">
              flashstock.pe/precios
            </a>{" "}
            y pueden actualizarse; el Negocio será notificado antes de que un cambio de precio le sea aplicable. El cobro es
            mensual, por adelantado, a la tarjeta o método registrado.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-zinc-200">3. Responsabilidad sobre la facturación electrónica</h2>
          <p>
            FlashStock provee la infraestructura técnica para firmar y enviar comprobantes a SUNAT usando el Certificado Digital y
            las credenciales SOL propias del Negocio. El Negocio es el único responsable de la exactitud de los datos fiscales que
            ingresa (RUC, dirección, series) y del cumplimiento de sus obligaciones tributarias ante SUNAT.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-zinc-200">4. Datos del cliente final</h2>
          <p>
            El Negocio es responsable frente a sus propios clientes (consumidores finales) por la venta de sus productos,
            entregas, cambios y devoluciones — FlashStock es un proveedor de tecnología, no parte de esas transacciones.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-zinc-200">5. Cancelación</h2>
          <p>El Negocio puede cancelar su suscripción en cualquier momento desde su panel; el acceso se mantiene hasta el final del período ya pagado.</p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-zinc-200">6. Modificaciones</h2>
          <p>FlashStock podrá actualizar estos Términos y Condiciones; la versión vigente es siempre la publicada en esta página.</p>
        </div>

        <p className="text-xs text-zinc-600">Última actualización: {new Date().toLocaleDateString("es-PE")}.</p>
      </div>
    </div>
  );
}
