import QRCode from "qrcode";
import { computeLineBreakdowns, sumTotals } from "./xml-common";
import type { SunatInvoicePayload } from "./types";

/**
 * Contenido del QR exigido por SUNAT en la representación impresa (Anexo N°7): 10 campos
 * separados por "|", en este orden exacto — no es negociable el orden ni el formato de cada
 * campo. El décimo campo ("Valor Resumen") es el `<ds:DigestValue>` de la firma XAdES-BES del
 * comprobante — ver `extract-digest.ts`. **Bug real corregido**: esta función solo tenía 9 campos
 * (faltaba el Valor Resumen) desde que se escribió — nunca se había verificado contra la
 * especificación oficial del Anexo N°7 hasta ahora.
 */
export function buildQrContent(payload: SunatInvoicePayload, documentDigest: string): string {
  // Los mismos totales que arma el XML, no un cálculo paralelo: el IGV del QR tiene que coincidir
  // exactamente con el del comprobante firmado, y con afectaciones mezcladas no hay forma de
  // derivarlo del total sin mirar línea por línea.
  const { totalIgv, totalVenta } = sumTotals(computeLineBreakdowns(payload.lineas));

  return [
    payload.emisor.ruc,
    payload.tipoDocumento,
    payload.serie,
    String(payload.numero),
    totalIgv.toFixed(2),
    totalVenta.toFixed(2),
    payload.fechaEmision.toISOString().slice(0, 10),
    payload.cliente.documentTypeCode,
    payload.cliente.documentNumber,
    documentDigest,
  ].join("|");
}

export async function generateQrDataUrl(payload: SunatInvoicePayload, documentDigest: string): Promise<string> {
  return QRCode.toDataURL(buildQrContent(payload, documentDigest), { errorCorrectionLevel: "M", margin: 1, width: 200 });
}
