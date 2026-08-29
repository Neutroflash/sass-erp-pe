import { calculateTaxBreakdown } from "../tax";
import { montoEnLetras } from "./amount-to-words";
import type { SunatInvoicePayload } from "./types";

/** Blinda un CDATA contra el único caso en que "]]>" dentro del texto rompería el cierre. */
function cdata(text: string): string {
  return `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function formatAmount(n: number): string {
  return n.toFixed(2);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * UBL 2.1 Invoice para Boleta (03) / Factura (01) — estructura documentada en el Anexo N°55 de
 * SUNAT (Estructuras y condiciones de uso del sistema de emisión electrónica), reconstruida acá a
 * partir de esa referencia pública. El nodo de firma se deja como un `<ext:ExtensionContent>`
 * vacío a propósito: `sign.ts` lo completa después, insertando el `<ds:Signature>` ahí adentro —
 * separar generación de firma es lo que permite reintentar un envío (PENDING_SUNAT) sin volver a
 * construir el XML desde cero.
 *
 * ⚠️ Pendiente de validar contra el ambiente beta real de SUNAT antes de producción: esta
 * estructura sigue la especificación al pie de la letra según la documentación, pero SUNAT es
 * conocido por rechazar documentos por detalles mínimos (orden exacto de nodos, catálogos
 * específicos por rubro) que solo un envío real contra `e-beta.sunat.gob.pe` puede confirmar.
 */
export function generateInvoiceXML(payload: SunatInvoicePayload): string {
  const { emisor, cliente, lineas, tipoDocumento, serie, numero, fechaEmision } = payload;

  const lineBreakdowns = lineas.map((line) => {
    const lineTotal = line.unitPriceWithTax * line.quantity;
    const { taxedAmount, igvAmount } = calculateTaxBreakdown(lineTotal);
    const unitValue = line.quantity > 0 ? taxedAmount / line.quantity : 0;
    return { ...line, lineTotal, taxedAmount, igvAmount, unitValue };
  });

  const totalGravada = lineBreakdowns.reduce((sum, l) => sum + l.taxedAmount, 0);
  const totalIgv = lineBreakdowns.reduce((sum, l) => sum + l.igvAmount, 0);
  const totalVenta = lineBreakdowns.reduce((sum, l) => sum + l.lineTotal, 0);

  const invoiceLines = lineBreakdowns
    .map(
      (line, i) => `
  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="NIU">${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="PEN">${formatAmount(line.taxedAmount)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="PEN">${formatAmount(line.unitPriceWithTax)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="PEN">${formatAmount(line.igvAmount)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="PEN">${formatAmount(line.taxedAmount)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="PEN">${formatAmount(line.igvAmount)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>18</cbc:Percent>
          <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${cdata(line.description)}</cbc:Description>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="PEN">${formatAmount(line.unitValue)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="ISO-8859-1" standalone="no"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:qdt="urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2" xmlns:udt="urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2" xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent></ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${serie}-${numero}</cbc:ID>
  <cbc:IssueDate>${formatDate(fechaEmision)}</cbc:IssueDate>
  <cbc:InvoiceTypeCode listID="0101" listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${tipoDocumento}</cbc:InvoiceTypeCode>
  <cbc:Note languageLocaleID="1000">${cdata(montoEnLetras(totalVenta))}</cbc:Note>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>${emisor.ruc}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${cdata(emisor.businessName)}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SunatSignature</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(emisor.businessName)}</cbc:RegistrationName>
        ${
          emisor.address
            ? `<cac:RegistrationAddress><cac:AddressLine><cbc:Line>${cdata(emisor.address)}</cbc:Line></cac:AddressLine></cac:RegistrationAddress>`
            : ""
        }
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${cliente.documentTypeCode}">${cliente.documentNumber}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(cliente.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${formatAmount(totalIgv)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${formatAmount(totalGravada)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${formatAmount(totalIgv)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${formatAmount(totalGravada)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${formatAmount(totalVenta)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${formatAmount(totalVenta)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${invoiceLines}
</Invoice>`;
}
