import type { InvoicingGateway, IssueCreditDebitNoteInput, IssueInvoiceInput, IssueInvoiceResult } from "../gateway";
import { generateInvoiceXML } from "./xml-builder";
import { generateCreditNoteXML, generateDebitNoteXML } from "./note-xml-builder";
import { signSunatXML } from "./sign";
import { sendToSunat } from "./soap-client";
import {
  DOCUMENT_TYPE_CODE,
  SUNAT_DOCUMENT_TYPE_CODE,
  type SunatCredentials,
  type SunatDocumentTypeCode,
  type SunatInvoicePayload,
  type SunatNotePayload,
} from "./types";

const BUSINESS_DOCUMENT_TYPE_TO_SUNAT: Record<string, SunatDocumentTypeCode> = {
  DNI: DOCUMENT_TYPE_CODE.DNI,
  RUC: DOCUMENT_TYPE_CODE.RUC,
  CE: DOCUMENT_TYPE_CODE.CE,
  PASAPORTE: DOCUMENT_TYPE_CODE.PASAPORTE,
};

/**
 * Implementación real (sin PSE/OSE) del puerto InvoicingGateway: arma el XML UBL 2.1, lo firma
 * con el certificado propio del tenant, y lo envía directo al Web Service SOAP de SUNAT.
 *
 * ✅ **Los cuatro tipos de comprobante confirmados en vivo contra `e-beta.sunat.gob.pe` real, con
 * `ResponseCode "0"`**: Boleta, Factura, Nota de Crédito y Nota de Débito — ver docs/ROADMAP.md
 * para el detalle completo de las pruebas (incluye un bug real de encoding encontrado y corregido
 * en el camino, ver note-xml-builder.ts; y un HTTP 401 transitorio en el primer intento de Nota de
 * Débito, resuelto en un reintento aislado).
 */
export class SunatInvoicingGateway implements InvoicingGateway {
  constructor(private readonly credentials: SunatCredentials) {}

  async issueInvoice(input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
    const documentTypeCode = BUSINESS_DOCUMENT_TYPE_TO_SUNAT[input.documentType] ?? DOCUMENT_TYPE_CODE.SIN_DOCUMENTO;

    const payload: SunatInvoicePayload = {
      tipoDocumento: input.type === "FACTURA" ? "01" : "03",
      serie: input.series,
      numero: input.number,
      fechaEmision: new Date(),
      emisor: {
        ruc: input.emisorRuc ?? this.credentials.ruc,
        businessName: input.emisorBusinessName ?? "",
        address: input.emisorAddress,
      },
      cliente: {
        documentTypeCode,
        documentNumber: input.documentNumber,
        name: input.businessName ?? input.documentNumber,
      },
      lineas: input.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceWithTax: item.unitPrice,
      })),
    };

    const unsignedXml = generateInvoiceXML(payload);
    return this.signAndSend(unsignedXml, SUNAT_DOCUMENT_TYPE_CODE[input.type], payload.serie, payload.numero);
  }

  async issueCreditDebitNote(input: IssueCreditDebitNoteInput): Promise<IssueInvoiceResult> {
    const documentTypeCode = BUSINESS_DOCUMENT_TYPE_TO_SUNAT[input.documentType] ?? DOCUMENT_TYPE_CODE.SIN_DOCUMENTO;

    const payload: SunatNotePayload = {
      tipoNota: input.type === "NOTA_CREDITO" ? "07" : "08",
      serie: input.series,
      numero: input.number,
      fechaEmision: new Date(),
      motivoCodigo: input.reasonCode,
      motivoDescripcion: input.reasonDescription,
      documentoRelacionado: {
        tipoDocumento: input.relatedDocument.type === "FACTURA" ? "01" : "03",
        serie: input.relatedDocument.series,
        numero: input.relatedDocument.number,
      },
      emisor: {
        ruc: input.emisorRuc ?? this.credentials.ruc,
        businessName: input.emisorBusinessName ?? "",
        address: input.emisorAddress,
      },
      cliente: {
        documentTypeCode,
        documentNumber: input.documentNumber,
        name: input.businessName ?? input.documentNumber,
      },
      lineas: input.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceWithTax: item.unitPrice,
      })),
    };

    const unsignedXml = input.type === "NOTA_CREDITO" ? generateCreditNoteXML(payload) : generateDebitNoteXML(payload);
    return this.signAndSend(unsignedXml, SUNAT_DOCUMENT_TYPE_CODE[input.type], payload.serie, payload.numero);
  }

  private async signAndSend(unsignedXml: string, tipoDocumentoCode: string, serie: string, numero: number): Promise<IssueInvoiceResult> {
    const signedXml = signSunatXML(unsignedXml, this.credentials.certificate.pfxBuffer, this.credentials.certificate.password);

    const fileName = `${this.credentials.ruc}-${tipoDocumentoCode}-${serie}-${numero}`;
    const result = await sendToSunat(signedXml, this.credentials, fileName);

    if (result.transient) {
      // No es un rechazo — el documento firmado queda listo para reintentar tal cual está.
      return { status: "PENDING_SUNAT", pdfUrl: null, xmlUrl: null, raw: result, signedXml };
    }

    return {
      status: result.accepted ? "ISSUED" : "FAILED",
      pdfUrl: null, // el PDF se genera bajo demanda (domain/invoicing/sunat/pdf.ts), no se almacena acá
      xmlUrl: null,
      raw: { responseCode: result.responseCode, description: result.description },
      signedXml,
    };
  }
}
