import { randomUUID } from "crypto";
import type { InvoicingGateway, IssueCreditDebitNoteInput, IssueInvoiceInput, IssueInvoiceResult } from "./gateway";

// Stand-in mientras ningún tenant esté registrado como emisor electrónico ante SUNAT con un PSE
// real — ver el comentario en gateway.ts. Siempre "emite" con éxito; no hay un caso de negocio
// real que probar contra un fallo del proveedor todavía.
export const fakeInvoicingGateway: InvoicingGateway = {
  async issueInvoice(input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
    const fakeId = randomUUID();
    return {
      status: "ISSUED",
      pdfUrl: `https://fake-pse.local/${input.series}-${input.number}/${fakeId}.pdf`,
      xmlUrl: `https://fake-pse.local/${input.series}-${input.number}/${fakeId}.xml`,
      raw: { fake: true, series: input.series, number: input.number, tenantId: input.tenantId },
    };
  },

  async issueCreditDebitNote(input: IssueCreditDebitNoteInput): Promise<IssueInvoiceResult> {
    const fakeId = randomUUID();
    return {
      status: "ISSUED",
      pdfUrl: `https://fake-pse.local/${input.series}-${input.number}/${fakeId}.pdf`,
      xmlUrl: `https://fake-pse.local/${input.series}-${input.number}/${fakeId}.xml`,
      raw: { fake: true, series: input.series, number: input.number, tenantId: input.tenantId, relatedDocument: input.relatedDocument },
    };
  },
};
