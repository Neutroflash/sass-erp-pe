import { montoEnLetras } from "./amount-to-words";
import {
  buildCustomerPartyBlock,
  buildLineTaxTotalBlock,
  buildSignatureBlock,
  buildSupplierPartyBlock,
  buildTaxTotalBlock,
  cdata,
  computeLineBreakdowns,
  formatAmount,
  formatDate,
  sumTotals,
  UBL_EXTENSIONS_PLACEHOLDER,
} from "./xml-common";
import type { SunatNotePayload } from "./types";

const COMMON_NAMESPACES =
  'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2" xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2" xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1"';

/** `cac:DiscrepancyResponse` + `cac:BillingReference` — el par de bloques que hace que una nota
 * sea una CORRECCIÓN de un documento específico, no un comprobante suelto. Idéntico entre nota de
 * crédito y de débito, solo cambia qué catálogo (09 vs 10) trae el `motivoCodigo`. */
function buildDiscrepancyAndReferenceBlocks(payload: SunatNotePayload): string {
  const related = payload.documentoRelacionado;
  return `<cac:DiscrepancyResponse>
    <cbc:ReferenceID>${related.serie}-${related.numero}</cbc:ReferenceID>
    <cbc:ResponseCode>${payload.motivoCodigo}</cbc:ResponseCode>
    <cbc:Description>${cdata(payload.motivoDescripcion)}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${related.serie}-${related.numero}</cbc:ID>
      <cbc:DocumentTypeCode>${related.tipoDocumento}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
}

/**
 * UBL 2.1 CreditNote — estructura documentada en el Anexo N°55 de SUNAT, análoga a
 * generateInvoiceXML (mismos bloques de emisor/cliente/impuestos/firma) más
 * `DiscrepancyResponse`/`BillingReference` (qué comprobante corrige y por qué — catálogo 09) que
 * son específicos de una nota.
 *
 * ✅ **Confirmado en vivo contra `e-beta.sunat.gob.pe` real** — `ResponseCode "0"`, "La Nota de
 * Credito numero BC01-1, ha sido aceptada". En el camino se encontró y corrigió un bug real: el
 * XML declaraba `encoding="ISO-8859-1"` pero los bytes enviados eran UTF-8 (`Buffer.from(...,
 * "utf8")` en soap-client.ts) — con texto sin tildes (las pruebas de Invoice) esto es
 * indistinguible, pero con texto acentuado real ("Anulación", "operación") SUNAT decodificaba
 * los bytes distinto a como yo los canonicalizaba localmente, y el digest de la firma no
 * coincidía (`faultcode Client.2335`, "Incorrect reference digest value"). Corregido declarando
 * `UTF-8` (lo que de verdad se envía) — afecta a los tres generadores (Invoice también), no solo
 * a las notas: cualquier razón social o dirección con tilde/ñ real lo habría disparado tarde o
 * temprano.
 */
export function generateCreditNoteXML(payload: SunatNotePayload): string {
  const { emisor, cliente, lineas, serie, numero, fechaEmision } = payload;
  const lineBreakdowns = computeLineBreakdowns(lineas);
  const totals = sumTotals(lineBreakdowns);

  const noteLines = lineBreakdowns
    .map(
      (line, i) => `
  <cac:CreditNoteLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:CreditedQuantity unitCode="NIU">${line.quantity}</cbc:CreditedQuantity>
    <cbc:LineExtensionAmount currencyID="PEN">${formatAmount(line.taxedAmount)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="PEN">${formatAmount(line.unitPriceWithTax)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    ${buildLineTaxTotalBlock(line)}
    <cac:Item>
      <cbc:Description>${cdata(line.description)}</cbc:Description>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="PEN">${formatAmount(line.unitValue)}</cbc:PriceAmount>
    </cac:Price>
  </cac:CreditNoteLine>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" ${COMMON_NAMESPACES}>
  ${UBL_EXTENSIONS_PLACEHOLDER}
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${serie}-${numero}</cbc:ID>
  <cbc:IssueDate>${formatDate(fechaEmision)}</cbc:IssueDate>
  <cbc:Note languageLocaleID="1000">${cdata(montoEnLetras(totals.totalVenta))}</cbc:Note>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
  ${buildDiscrepancyAndReferenceBlocks(payload)}
  ${buildSignatureBlock(emisor.ruc, emisor.businessName)}
  ${buildSupplierPartyBlock(emisor)}
  ${buildCustomerPartyBlock(cliente)}
  ${buildTaxTotalBlock(totals)}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${formatAmount(totals.totalGravada)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${formatAmount(totals.totalVenta)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${formatAmount(totals.totalVenta)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${noteLines}
</CreditNote>`;
}

/**
 * UBL 2.1 DebitNote — misma lógica que generateCreditNoteXML (mismo fix de encoding incluido), con
 * dos diferencias estructurales reales (no cosméticas): las líneas usan
 * `cbc:DebitedQuantity`/`cac:DebitNoteLine`, y el total del documento va en
 * `cac:RequestedMonetaryTotal` en vez de `cac:LegalMonetaryTotal` — así lo define el propio schema
 * UBL 2.1 para el tipo de documento DebitNote, no es una elección nuestra.
 *
 * ⚠️ **Sin confirmar contra beta todavía** — a diferencia de CreditNote, el envío de prueba
 * recibió un HTTP 401 (no el error de digest/formato de las rondas anteriores), inmediatamente
 * después de un envío exitoso de CreditNote con las mismas credenciales — más consistente con un
 * límite de tasa transitorio del ambiente beta que con un problema real del documento, pero no se
 * insistió más para no abusar del ambiente de homologación de SUNAT. La estructura comparte el
 * 100% de la mecánica ya confirmada (firma, encoding, DiscrepancyResponse/BillingReference) salvo
 * el intercambio de `RequestedMonetaryTotal`.
 */
export function generateDebitNoteXML(payload: SunatNotePayload): string {
  const { emisor, cliente, lineas, serie, numero, fechaEmision } = payload;
  const lineBreakdowns = computeLineBreakdowns(lineas);
  const totals = sumTotals(lineBreakdowns);

  const noteLines = lineBreakdowns
    .map(
      (line, i) => `
  <cac:DebitNoteLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:DebitedQuantity unitCode="NIU">${line.quantity}</cbc:DebitedQuantity>
    <cbc:LineExtensionAmount currencyID="PEN">${formatAmount(line.taxedAmount)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="PEN">${formatAmount(line.unitPriceWithTax)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    ${buildLineTaxTotalBlock(line)}
    <cac:Item>
      <cbc:Description>${cdata(line.description)}</cbc:Description>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="PEN">${formatAmount(line.unitValue)}</cbc:PriceAmount>
    </cac:Price>
  </cac:DebitNoteLine>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<DebitNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2" ${COMMON_NAMESPACES}>
  ${UBL_EXTENSIONS_PLACEHOLDER}
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${serie}-${numero}</cbc:ID>
  <cbc:IssueDate>${formatDate(fechaEmision)}</cbc:IssueDate>
  <cbc:Note languageLocaleID="1000">${cdata(montoEnLetras(totals.totalVenta))}</cbc:Note>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
  ${buildDiscrepancyAndReferenceBlocks(payload)}
  ${buildSignatureBlock(emisor.ruc, emisor.businessName)}
  ${buildSupplierPartyBlock(emisor)}
  ${buildCustomerPartyBlock(cliente)}
  ${buildTaxTotalBlock(totals)}
  <cac:RequestedMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${formatAmount(totals.totalGravada)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${formatAmount(totals.totalVenta)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${formatAmount(totals.totalVenta)}</cbc:PayableAmount>
  </cac:RequestedMonetaryTotal>${noteLines}
</DebitNote>`;
}
