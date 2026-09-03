import { calculateTaxBreakdown, lineValue as breakdownLineValue, sumTaxBreakdowns } from "../tax";
import { resolveTaxAffectation } from "../tax-affectation";
import type { SunatCustomerInfo, SunatInvoiceLine, SunatPartyInfo } from "./types";
import { isPositiveQty, lineTotal as computeLineTotal, toQty, QTY_SCALE } from "@/domain/inventory/quantity";
import { DEFAULT_UNIT_CODE } from "@/domain/inventory/units";

/** Blinda un CDATA contra el único caso en que "]]>" dentro del texto rompería el cierre. */
export function cdata(text: string): string {
  return `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export function formatAmount(n: number): string {
  return n.toFixed(2);
}

/** Cantidad en la escala del sistema (3 decimales): "3.500" metros es un valor válido para SUNAT. */
export function formatQuantity(n: number): string {
  return toQty(n).toFixed(QTY_SCALE);
}

/**
 * Valor unitario, con más decimales que un importe.
 *
 * SUNAT contrasta el valor de venta de la línea contra `valor unitario × cantidad`. Con dos
 * decimales y cantidades fraccionarias esa multiplicación se desvía: 254.24 entre 3.5 metros da
 * 72.6400000; redondeado a 72.64 vuelve a dar 254.24, pero con cantidades como 0.375 el error
 * supera la tolerancia. El estándar admite hasta 10 decimales acá justamente por eso; usamos 6,
 * que deja el error del orden del millonésimo de sol y mantiene el XML legible.
 */
export function formatUnitAmount(n: number): string {
  return n.toFixed(6);
}

/** Catálogo 03: NIU (unidad) es el valor con el que se comportaba todo antes de existir el campo. */
export function resolveUnitCode(unitCode?: string): string {
  return unitCode && unitCode.trim() ? unitCode : DEFAULT_UNIT_CODE;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface LineBreakdown extends SunatInvoiceLine {
  lineTotal: number;
  taxedAmount: number;
  exemptAmount: number;
  unaffectedAmount: number;
  igvAmount: number;
  /** Base imponible de la línea, cualquiera sea su afectación — `cbc:LineExtensionAmount`. */
  lineValue: number;
  unitValue: number;
}

export function computeLineBreakdowns(lineas: SunatInvoiceLine[]): LineBreakdown[] {
  return lineas.map((line) => {
    const lineTotal = computeLineTotal(line.quantity, line.unitPriceWithTax);
    const breakdown = calculateTaxBreakdown(lineTotal, line.taxAffectationCode);
    const value = breakdownLineValue(breakdown);
    const unitValue = isPositiveQty(line.quantity) ? value / toQty(line.quantity) : 0;
    return { ...line, lineTotal, ...breakdown, lineValue: value, unitValue };
  });
}

export interface DocumentTotals {
  totalGravada: number;
  totalExonerada: number;
  totalInafecta: number;
  totalIgv: number;
  /** Suma de las tres bases — `cbc:LineExtensionAmount` del documento. */
  totalValorVenta: number;
  totalVenta: number;
}

export function sumTotals(breakdowns: LineBreakdown[]): DocumentTotals {
  const totals = sumTaxBreakdowns(breakdowns);
  return {
    totalGravada: totals.taxedAmount,
    totalExonerada: totals.exemptAmount,
    totalInafecta: totals.unaffectedAmount,
    totalIgv: totals.igvAmount,
    totalValorVenta: breakdownLineValue(totals),
    totalVenta: breakdowns.reduce((sum, l) => sum + l.lineTotal, 0),
  };
}

/** `ext:UBLExtensions` con el `ExtensionContent` vacío que `sign.ts` completa después — idéntico
 * para Invoice/CreditNote/DebitNote, todos comparten el mismo mecanismo de extensión UBL. */
export const UBL_EXTENSIONS_PLACEHOLDER = `<ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent></ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>`;

export function buildSignatureBlock(emisorRuc: string, emisorBusinessName: string): string {
  return `<cac:Signature>
    <cbc:ID>${emisorRuc}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${emisorRuc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${cdata(emisorBusinessName)}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#SunatSignature</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>`;
}

/**
 * `cbc:AddressTypeCode` ("0000" = domicilio fiscal, el código de establecimiento anexo por
 * default cuando el negocio no tiene sucursales registradas ante SUNAT aparte) — encontrado como
 * bug real portando este módulo a flashkings-backend y probando FACTURA en vivo contra
 * `e-beta.sunat.gob.pe`: BOLETA lo acepta sin este tag, FACTURA lo rechaza con "INFO: 3030 ...
 * no existe información del código de local anexo del emisor". Solo se había confirmado Boleta en
 * vivo acá — nunca Factura con un comprador RUC real. Siempre presente ahora (Boleta lo sigue
 * aceptando igual con el tag de más).
 */
export function buildSupplierPartyBlock(emisor: SunatPartyInfo): string {
  return `<cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(emisor.businessName)}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          ${emisor.address ? `<cac:AddressLine><cbc:Line>${cdata(emisor.address)}</cbc:Line></cac:AddressLine>` : ""}
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
}

export function buildCustomerPartyBlock(cliente: SunatCustomerInfo): string {
  return `<cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${cliente.documentTypeCode}">${cliente.documentNumber}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(cliente.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

/**
 * `cac:TaxTotal` del documento — un `cac:TaxSubtotal` por cada afectación presente.
 *
 * Un comprobante con líneas gravadas y exoneradas mezcladas debe declarar ambas bases por
 * separado, cada una bajo su propio esquema del catálogo 05; meterlas todas bajo IGV/1000 declara
 * como base imponible plata que no lo es. Se omite el subtotal de una afectación que no aparece en
 * ninguna línea, salvo el de gravadas cuando el documento entero está en cero — SUNAT espera al
 * menos un subtotal, y ese es el neutro.
 */
export function buildTaxTotalBlock(totals: DocumentTotals): string {
  const subtotals = [
    { code: "10", base: totals.totalGravada, tax: totals.totalIgv },
    { code: "20", base: totals.totalExonerada, tax: 0 },
    { code: "30", base: totals.totalInafecta, tax: 0 },
  ].filter((s) => s.base !== 0 || s.tax !== 0);

  const present = subtotals.length > 0 ? subtotals : [{ code: "10", base: 0, tax: 0 }];

  const blocks = present
    .map(({ code, base, tax }) => {
      const affectation = resolveTaxAffectation(code);
      return `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${formatAmount(base)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${formatAmount(tax)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>${affectation.taxSchemeId}</cbc:ID>
          <cbc:Name>${affectation.taxSchemeName}</cbc:Name>
          <cbc:TaxTypeCode>${affectation.taxTypeCode}</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`;
    })
    .join("");

  return `<cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${formatAmount(totals.totalIgv)}</cbc:TaxAmount>${blocks}
  </cac:TaxTotal>`;
}

/**
 * Bloque de impuestos por línea (`cac:TaxTotal` dentro de una InvoiceLine/CreditNoteLine/
 * DebitNoteLine) — mismo formato en los tres tipos de documento.
 *
 * `cbc:Percent` y `cbc:TaxExemptionReasonCode` ya no son constantes: son lo que le dice a SUNAT
 * por qué esta línea no paga IGV. Una línea exonerada con `Percent 18` y razón `10` es una línea
 * gravada a la que simplemente no se le calculó el impuesto — un rechazo, y con razón.
 */
export function buildLineTaxTotalBlock(line: LineBreakdown): string {
  const affectation = resolveTaxAffectation(line.taxAffectationCode);
  return `<cac:TaxTotal>
      <cbc:TaxAmount currencyID="PEN">${formatAmount(line.igvAmount)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="PEN">${formatAmount(line.lineValue)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="PEN">${formatAmount(line.igvAmount)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>${Math.round(affectation.rate * 100)}</cbc:Percent>
          <cbc:TaxExemptionReasonCode>${affectation.code}</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>${affectation.taxSchemeId}</cbc:ID>
            <cbc:Name>${affectation.taxSchemeName}</cbc:Name>
            <cbc:TaxTypeCode>${affectation.taxTypeCode}</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>`;
}
