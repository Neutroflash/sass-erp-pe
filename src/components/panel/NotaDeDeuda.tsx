import type { DebtNoteData } from "@/domain/customers/debt-note";
import { cn } from "@/lib/utils";

function money(n: number): string {
  return n.toFixed(2);
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fullDateTime(d: Date): string {
  return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Estado de cuenta imprimible para entregarle a quien debe — el papel que el negocio pidió como
 * «una boleta por pagar».
 *
 * Comparte el formato térmico de 72 mm con `TicketComprobante` (mismo rollo, misma impresora) y
 * **deliberadamente nada más**. Todo lo que identifica a un comprobante de pago está ausente por
 * diseño, no por omisión:
 *
 * - Sin QR y sin hash: son los dos elementos que un cliente peruano asocia de inmediato con un
 *   comprobante electrónico válido.
 * - Sin serie ni correlativo propio: no es un documento numerado ante SUNAT.
 * - Sin la palabra "boleta" ni "factura" en ninguna parte, ni siquiera en el título.
 * - Con una leyenda explícita de que no es comprobante de pago, arriba y abajo.
 *
 * Lo que sí lleva es la referencia a los comprobantes que SÍ se emitieron por esas ventas — eso lo
 * vuelve útil para cobrar y, a la vez, deja claro cuál es el documento fiscal y cuál no.
 */
export function NotaDeDeuda({ data }: { data: DebtNoteData }) {
  const { emisor, cliente, lines, total, overdueTotal, issuedAt } = data;

  return (
    <div
      id="nota-de-deuda"
      className={cn(
        "mx-auto flex w-[320px] flex-col gap-2 overflow-hidden border border-zinc-300 bg-white p-3 text-[11px] leading-snug text-black shadow-lg",
        "print:w-[72mm] print:border-none print:p-1 print:shadow-none",
      )}
      style={{ fontFamily: "'Courier New', Courier, monospace" }}
    >
      <div className="text-center print:break-inside-avoid">
        <p className="text-sm font-bold uppercase">{emisor.businessName}</p>
        {emisor.ruc && <p>RUC {emisor.ruc}</p>}
        {emisor.address && <p className="break-words">{emisor.address}</p>}
        {emisor.phone && <p>Tel. {emisor.phone}</p>}
      </div>

      <div className="border-t border-dashed border-black" />

      <div className="text-center print:break-inside-avoid">
        <p className="text-sm font-bold uppercase">Estado de cuenta</p>
        {/* La leyenda va arriba, no en letra chica al pie: quien recibe el papel tiene que saber
            qué es antes de guardarlo, no después de perderlo. */}
        <p className="mt-0.5 border border-black px-1 py-0.5 text-[9px] font-bold uppercase">
          No es comprobante de pago
        </p>
      </div>

      <div className="border-t border-dashed border-black" />

      <div className="flex flex-col gap-0.5 print:break-inside-avoid">
        <div className="flex justify-between gap-2">
          <span className="shrink-0">Cliente:</span>
          <span className="text-right font-bold">{cliente.name}</span>
        </div>
        {cliente.docNumber && (
          <div className="flex justify-between gap-2">
            <span className="shrink-0">{cliente.docType ?? "Doc"}:</span>
            <span className="text-right">{cliente.docNumber}</span>
          </div>
        )}
        {cliente.address && (
          <div className="flex justify-between gap-2">
            <span className="shrink-0">Dirección:</span>
            <span className="text-right">{cliente.address}</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span className="shrink-0">Emitido:</span>
          <span className="text-right">{fullDateTime(issuedAt)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black" />

      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-0.5 pr-1 font-bold">Fecha</th>
            <th className="py-0.5 pr-1 font-bold">Comprobante</th>
            <th className="py-0.5 text-right font-bold">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.orderId} className="align-top print:break-inside-avoid">
              <td className="py-0.5 pr-1">
                {shortDate(line.date)}
                {line.dueDate && (
                  <span className="block text-[8px]">
                    {line.overdue ? "venció " : "vence "}
                    {shortDate(line.dueDate)}
                  </span>
                )}
              </td>
              <td className="py-0.5 pr-1">
                {line.comprobante ?? <span className="text-[9px]">—</span>}
                {line.paid > 0 && <span className="block text-[8px]">a cuenta {money(line.paid)}</span>}
              </td>
              <td className="py-0.5 text-right">{money(line.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-black" />

      <div className="flex flex-col gap-0.5 print:break-inside-avoid">
        {overdueTotal > 0 && (
          <div className="flex justify-between">
            <span>Vencido</span>
            <span>S/ {money(overdueTotal)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between text-sm font-bold">
          <span>TOTAL ADEUDADO</span>
          <span>S/ {money(total)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black" />

      <div className="flex flex-col gap-1 text-center print:break-inside-avoid">
        <p className="text-[9px]">
          Documento informativo del saldo pendiente a la fecha indicada. No sustituye a los
          comprobantes de pago emitidos, que son los indicados en el detalle.
        </p>
        <p className="mt-2 text-[8px]">Emitido mediante el sistema FlashStock</p>
      </div>
    </div>
  );
}
