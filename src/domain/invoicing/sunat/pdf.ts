import PDFDocument from "pdfkit";
import { computeLineBreakdowns, sumTotals } from "./xml-common";
import { buildQrContent } from "./qr";
import QRCode from "qrcode";
import type { SunatInvoicePayload } from "./types";

function formatAmount(n: number): string {
  return n.toFixed(2);
}

/** Representación impresa mínima (no reemplaza al XML/CDR, que es el comprobante legal en sí) —
 * suficiente para entregarle algo legible al cliente en el mostrador o por correo. `documentDigest`
 * es el "Valor Resumen" del QR (10° campo, ver qr.ts) — el llamador lo extrae de `invoice.signedXml`
 * ya persistido (`extractDocumentDigestValue`). */
export async function generatePDFComprobante(payload: SunatInvoicePayload, documentDigest: string): Promise<Buffer> {
  const totals = sumTotals(computeLineBreakdowns(payload.lineas));
  const qrPngBuffer = await QRCode.toBuffer(buildQrContent(payload, documentDigest), { errorCorrectionLevel: "M", margin: 1, width: 150 });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const tipoLabel = payload.tipoDocumento === "01" ? "FACTURA ELECTRÓNICA" : "BOLETA DE VENTA ELECTRÓNICA";

    doc.fontSize(14).text(payload.emisor.businessName, { continued: false });
    doc.fontSize(9).text(`RUC ${payload.emisor.ruc}`);
    if (payload.emisor.address) doc.text(payload.emisor.address);
    doc.moveDown();

    doc.rect(doc.x, doc.y, 220, 50).stroke();
    doc.fontSize(11).text(tipoLabel, doc.x + 10, doc.y + 10, { width: 200 });
    doc.fontSize(12).text(`${payload.serie}-${payload.numero}`, doc.x + 10, doc.y + 4, { width: 200 });
    doc.moveDown(3);

    doc.fontSize(9);
    doc.text(`Fecha de emisión: ${payload.fechaEmision.toISOString().slice(0, 10)}`);
    doc.text(`Cliente: ${payload.cliente.name}`);
    doc.text(`Documento: ${payload.cliente.documentNumber || "—"}`);
    doc.moveDown();

    const tableTop = doc.y;
    doc.font("Helvetica-Bold");
    doc.text("Descripción", 40, tableTop, { width: 260 });
    doc.text("Cant.", 300, tableTop, { width: 50 });
    doc.text("P. Unit.", 350, tableTop, { width: 80 });
    doc.text("Importe", 440, tableTop, { width: 80 });
    doc.font("Helvetica");
    doc.moveDown(0.5);

    for (const line of payload.lineas) {
      const y = doc.y;
      const lineTotal = line.unitPriceWithTax * line.quantity;
      doc.text(line.description, 40, y, { width: 260 });
      doc.text(String(line.quantity), 300, y, { width: 50 });
      doc.text(formatAmount(line.unitPriceWithTax), 350, y, { width: 80 });
      doc.text(formatAmount(lineTotal), 440, y, { width: 80 });
      doc.moveDown(0.5);
    }

    doc.moveDown();
    // Solo las operaciones que el comprobante realmente tiene: imprimir "Op. Exonerada: S/ 0.00"
    // en una venta gravada normal es ruido, y peor, sugiere un desglose que no existe. Si todas
    // son cero (comprobante en cero) igual se imprime la gravada, para no dejar el bloque vacío.
    const operaciones = [
      ["Op. Gravada", totals.totalGravada],
      ["Op. Exonerada", totals.totalExonerada],
      ["Op. Inafecta", totals.totalInafecta],
    ].filter(([, amount]) => amount !== 0);
    for (const [label, amount] of operaciones.length > 0 ? operaciones : [["Op. Gravada", 0]]) {
      doc.text(`${label}: S/ ${formatAmount(amount as number)}`, { align: "right" });
    }
    doc.text(`IGV (18%): S/ ${formatAmount(totals.totalIgv)}`, { align: "right" });
    doc.fontSize(11).text(`Importe Total: S/ ${formatAmount(totals.totalVenta)}`, { align: "right" });

    doc.image(qrPngBuffer, 40, doc.page.height - 200, { width: 100 });
    doc.fontSize(7).text("Representación impresa del comprobante electrónico", 150, doc.page.height - 160, { width: 300 });

    doc.end();
  });
}
