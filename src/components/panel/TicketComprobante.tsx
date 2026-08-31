import { QRCodeSVG } from "qrcode.react";
import type { TicketComprobanteData } from "@/types/ticket";

function formatMoney(n: number): string {
  return n.toFixed(2);
}

// Correlativo SUNAT: serie de 4 + guion + 8 dígitos (ej. B001-00000142) — no es negociable el
// padding, es el formato exigido para la representación impresa.
function formatNumeroComprobante(serie: string, numero: number): string {
  return `${serie}-${String(numero).padStart(8, "0")}`;
}

function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fecha} ${hora}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0">{label}:</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

/**
 * Representación Impresa (RICE) de una Boleta/Factura electrónica — formato de ticket térmico
 * continuo (80mm / 320px), pensado tanto para impresión POS como para exportación a PDF (vía el
 * diálogo nativo de impresión del navegador, `window.print()`) y PNG (vía `html-to-image`, ver
 * `TicketActions.tsx`). Puramente presentacional: todo lo que exige criptografía/formato oficial
 * (hash, monto en letras) llega ya resuelto en `data`, calculado en el backend — este componente
 * nunca reimplementa esa lógica.
 *
 * Fondo blanco/texto negro fijo, independiente del tema oscuro del resto del panel — es un ticket
 * de papel térmico, no una pantalla; debe verse igual (y imprimirse limpio) sin importar de qué
 * tenant sea ni qué colores primarios tenga configurados.
 */
export function TicketComprobante({ data }: { data: TicketComprobanteData }) {
  const { emisor, comprobante, cliente, pago, items, totales } = data;
  const tipoLabel = comprobante.tipo === "FACTURA" ? "FACTURA ELECTRÓNICA" : "BOLETA DE VENTA ELECTRÓNICA";

  return (
    <div
      id="ticket-comprobante"
      className="mx-auto flex w-[320px] flex-col gap-2 border border-zinc-300 bg-white p-3 text-[11px] leading-snug text-black shadow-lg print:w-full print:border-none print:p-0 print:shadow-none"
      style={{ fontFamily: "'Courier New', Courier, monospace" }}
    >
      {/* 1. Encabezado del emisor */}
      <div className="text-center">
        <p className="text-sm font-bold uppercase">{emisor.businessName}</p>
        <p>RUC {emisor.ruc}</p>
        <p className="break-words">{emisor.address}</p>
        {emisor.phone && <p>{emisor.phone}</p>}
      </div>

      <div className="border-t border-dashed border-black" />

      {/* 2. Encabezado del comprobante */}
      <div className="text-center">
        <p className="font-bold">{tipoLabel}</p>
        <p className="text-sm font-bold">{formatNumeroComprobante(comprobante.serie, comprobante.numero)}</p>
      </div>

      <div className="border-t border-dashed border-black" />

      {/* 3. Datos de la transacción y del cliente */}
      <div className="flex flex-col gap-0.5">
        <Row label="Fecha" value={formatFechaHora(comprobante.fechaEmision)} />
        <Row label="Cliente" value={cliente.nombre} />
        <Row label={cliente.documentoTipo} value={cliente.documentoNumero} />
        <Row label="Forma de pago" value={pago.forma === "CONTADO" ? "Contado" : "Crédito"} />
        {pago.medio && <Row label="Medio de pago" value={pago.medio} />}
      </div>

      <div className="border-t border-dashed border-black" />

      {/* 4. Tabla de ítems */}
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-0.5 pr-1 font-bold">Cant</th>
            <th className="py-0.5 pr-1 font-bold">Descripción</th>
            <th className="py-0.5 pr-1 text-right font-bold">P.U.</th>
            <th className="py-0.5 text-right font-bold">Importe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5 pr-1">{item.cantidad}</td>
              <td className="py-0.5 pr-1">{item.descripcion}</td>
              <td className="py-0.5 pr-1 text-right">{formatMoney(item.precioUnitario)}</td>
              <td className="py-0.5 text-right">{formatMoney(item.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-black" />

      {/* 5. Totales tributarios */}
      <div className="flex flex-col gap-0.5">
        <Row label="Op. Gravada" value={`S/ ${formatMoney(totales.opGravada)}`} />
        <Row label="IGV (18%)" value={`S/ ${formatMoney(totales.igv)}`} />
        {!!totales.opExonerada && <Row label="Op. Exonerada" value={`S/ ${formatMoney(totales.opExonerada)}`} />}
        {!!totales.opInafecta && <Row label="Op. Inafecta" value={`S/ ${formatMoney(totales.opInafecta)}`} />}
        <div className="mt-1 flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>S/ {formatMoney(totales.total)}</span>
        </div>
        <p className="mt-1 text-[10px] uppercase">SON: {totales.montoEnLetras}</p>
      </div>

      <div className="border-t border-dashed border-black" />

      {/* 6. Pie de página técnico */}
      <div className="flex flex-col items-center gap-1 text-center">
        <QRCodeSVG value={data.qrContent} size={110} level="M" />
        <p className="w-full break-all text-[8px] text-zinc-700">Resumen: {data.hash}</p>
        <p className="mt-1 text-[8px]">Representación Impresa del Comprobante de Pago Electrónico</p>
        <p className="text-[7px] text-zinc-500">Emitido mediante el sistema FlashStock</p>
      </div>
    </div>
  );
}
