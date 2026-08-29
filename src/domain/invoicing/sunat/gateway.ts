import type { InvoicingGateway, IssueInvoiceInput, IssueInvoiceResult } from "../gateway";
import { generateInvoiceXML } from "./xml-builder";
import { signInvoiceXML } from "./sign";
import { sendToSunat } from "./soap-client";
import { DOCUMENT_TYPE_CODE, type SunatCredentials, type SunatDocumentTypeCode, type SunatInvoicePayload } from "./types";

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
 * ⚠️ **Estado honesto de esta implementación**: la mecánica (estructura XML, ubicación y algoritmo
 * de la firma, envoltorio SOAP, parseo de CDR) sigue la especificación pública de SUNAT tal como
 * está documentada — no un paquete de terceros no auditable (ver la discusión completa en el
 * historial de este cambio). Lo que NO se pudo hacer, porque requeriría credenciales reales y
 * enviar tráfico no autorizado a un sistema del Estado peruano, es un envío de prueba real contra
 * `e-beta.sunat.gob.pe`. Antes de emitir un solo comprobante real con esto, el OWNER del negocio
 * (con su propio certificado de homologación) debe validar al menos un envío contra el ambiente
 * BETA y confirmar que el CDR vuelve con `ResponseCode = 0`.
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
    const signedXml = signInvoiceXML(unsignedXml, this.credentials.certificate.pfxBuffer, this.credentials.certificate.password);

    const fileName = `${this.credentials.ruc}-${payload.tipoDocumento}-${payload.serie}-${payload.numero}`;
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
