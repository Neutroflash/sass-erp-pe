export interface InvoiceLineInput {
  description: string;
  quantity: number;
  /** Catálogo 03 de SUNAT. Ausente = NIU (unidad), que es como se comportaba todo antes. */
  unitCode?: string;
  unitPrice: number;
}

export interface IssueInvoiceInput {
  tenantId: string;
  type: "BOLETA" | "FACTURA";
  series: string;
  number: number;
  documentType: string;
  documentNumber: string;
  businessName?: string;
  items: InvoiceLineInput[];
  totalAmount: number;
  /** Datos del emisor — solo los usa un gateway real (SUNAT); fakeInvoicingGateway los ignora. */
  emisorRuc?: string;
  emisorBusinessName?: string;
  emisorAddress?: string;
}

export interface IssueInvoiceResult {
  /**
   * PENDING_SUNAT: se intentó enviar y no hubo respuesta (SUNAT caído, timeout) — el documento en
   * sí es válido y ya está firmado, solo falta que SUNAT confirme recepción. Distinto de FAILED
   * (SUNAT respondió y rechazó el comprobante) — ver domain/invoicing/sunat/gateway.ts.
   */
  status: "ISSUED" | "FAILED" | "PENDING_SUNAT";
  pdfUrl: string | null;
  xmlUrl: string | null;
  raw: unknown;
  /** XML ya firmado — persistido para poder reintentar un PENDING_SUNAT sin volver a firmar. */
  signedXml?: string;
}

export interface RelatedDocumentInput {
  type: "BOLETA" | "FACTURA";
  series: string;
  number: number;
}

export interface IssueCreditDebitNoteInput {
  tenantId: string;
  type: "NOTA_CREDITO" | "NOTA_DEBITO";
  series: string;
  number: number;
  /** Catálogo 09 (nota de crédito) o 10 (nota de débito) de SUNAT. */
  reasonCode: string;
  reasonDescription: string;
  relatedDocument: RelatedDocumentInput;
  documentType: string;
  documentNumber: string;
  businessName?: string;
  items: InvoiceLineInput[];
  totalAmount: number;
  emisorRuc?: string;
  emisorBusinessName?: string;
  emisorAddress?: string;
}

/**
 * Puerto hacia quien sea que efectivamente emita el comprobante ante SUNAT — un PSE/OSE de pago
 * (ej. Nubefact) o, como implementamos acá, integración directa sin intermediario
 * (domain/invoicing/sunat/gateway.ts, con certificado digital propio del tenant). Un tenant sin
 * credenciales SUNAT configuradas sigue usando `fakeInvoicingGateway`
 * (src/domain/invoicing/fake-gateway.ts); el seam que decide cuál usar es
 * src/lib/invoicing-gateway.ts, no cada call site.
 */
export interface InvoicingGateway {
  issueInvoice(input: IssueInvoiceInput): Promise<IssueInvoiceResult>;
  issueCreditDebitNote(input: IssueCreditDebitNoteInput): Promise<IssueInvoiceResult>;
}
