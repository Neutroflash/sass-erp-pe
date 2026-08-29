export interface InvoiceLineInput {
  description: string;
  quantity: number;
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
}

export interface IssueInvoiceResult {
  status: "ISSUED" | "FAILED";
  pdfUrl: string | null;
  xmlUrl: string | null;
  raw: unknown;
}

/**
 * Puerto hacia un PSE/OSE autorizado por SUNAT (ej. Nubefact) — mismo rol que IInvoicingGateway
 * en Flashkings. Ningún tenant tiene credenciales propias con un proveedor real todavía, así que
 * `fakeInvoicingGateway` (src/domain/invoicing/fake-gateway.ts) es la única implementación por
 * ahora; el seam para conectar un proveedor real es src/lib/invoicing-gateway.ts, no cada call
 * site.
 */
export interface InvoicingGateway {
  issueInvoice(input: IssueInvoiceInput): Promise<IssueInvoiceResult>;
}
