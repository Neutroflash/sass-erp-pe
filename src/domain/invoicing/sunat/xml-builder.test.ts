import { describe, expect, test } from "bun:test";
import { generateInvoiceXML } from "./xml-builder";
import type { SunatInvoicePayload } from "./types";

function payloadWith(lineas: SunatInvoicePayload["lineas"]): SunatInvoicePayload {
  return {
    tipoDocumento: "03",
    serie: "B001",
    numero: 1,
    fechaEmision: new Date("2026-09-03T10:00:00Z"),
    emisor: { ruc: "20123456789", businessName: "TEXTILES DEL SUR SAC", address: "Av. Grau 123" },
    cliente: { documentTypeCode: "1", documentNumber: "44556677", name: "Juan Perez" },
    lineas,
  };
}

/** El bloque `cac:TaxTotal` del documento (el primero del XML, antes de las líneas). */
function documentTaxTotal(xml: string): string {
  const start = xml.indexOf("<cac:TaxTotal>");
  return xml.slice(start, xml.indexOf("</cac:TaxTotal>", start));
}

describe("generateInvoiceXML — afectación al IGV", () => {
  test("una línea gravada declara IGV 18% bajo el esquema 1000/IGV/VAT", () => {
    const xml = generateInvoiceXML(payloadWith([{ description: "Tela toalla", quantity: 2, unitPriceWithTax: 59 }]));

    expect(xml).toContain("<cbc:Percent>18</cbc:Percent>");
    expect(xml).toContain("<cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>");
    expect(xml).toContain("<cbc:ID>1000</cbc:ID>");
    expect(xml).toContain("<cbc:Name>IGV</cbc:Name>");
    // 118 con IGV incluido: base 100.00, IGV 18.00.
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="PEN">100.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="PEN">118.00</cbc:TaxInclusiveAmount>');
  });

  test("una línea exonerada no lleva IGV y va bajo su propio esquema 9997/EXO", () => {
    const xml = generateInvoiceXML(
      payloadWith([{ description: "Arroz", quantity: 1, unitPriceWithTax: 118, taxAffectationCode: "20" }]),
    );

    expect(xml).toContain("<cbc:Percent>0</cbc:Percent>");
    expect(xml).toContain("<cbc:TaxExemptionReasonCode>20</cbc:TaxExemptionReasonCode>");
    expect(xml).toContain("<cbc:ID>9997</cbc:ID>");
    expect(xml).toContain("<cbc:Name>EXO</cbc:Name>");
    expect(xml).not.toContain("<cbc:Name>IGV</cbc:Name>");
    // El total es la base entera: no se le extrajo ningún 18%.
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="PEN">118.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="PEN">118.00</cbc:TaxInclusiveAmount>');
    expect(documentTaxTotal(xml)).toContain('<cbc:TaxAmount currencyID="PEN">0.00</cbc:TaxAmount>');
  });

  test("una línea inafecta usa 9998/INA/FRE, no el VAT de exonerado", () => {
    const xml = generateInvoiceXML(
      payloadWith([{ description: "Servicio exportación", quantity: 1, unitPriceWithTax: 100, taxAffectationCode: "30" }]),
    );

    expect(xml).toContain("<cbc:ID>9998</cbc:ID>");
    expect(xml).toContain("<cbc:Name>INA</cbc:Name>");
    expect(xml).toContain("<cbc:TaxTypeCode>FRE</cbc:TaxTypeCode>");
    expect(xml).toContain("<cbc:TaxExemptionReasonCode>30</cbc:TaxExemptionReasonCode>");
  });

  test("un comprobante mixto declara una base por afectación, no todo bajo IGV", () => {
    const xml = generateInvoiceXML(
      payloadWith([
        { description: "Tela", quantity: 1, unitPriceWithTax: 118 },
        { description: "Arroz", quantity: 1, unitPriceWithTax: 50, taxAffectationCode: "20" },
      ]),
    );

    const taxTotal = documentTaxTotal(xml);
    // Gravadas: base 100.00 + IGV 18.00. Exoneradas: base 50.00 sin impuesto.
    expect(taxTotal).toContain('<cbc:TaxableAmount currencyID="PEN">100.00</cbc:TaxableAmount>');
    expect(taxTotal).toContain('<cbc:TaxableAmount currencyID="PEN">50.00</cbc:TaxableAmount>');
    expect(taxTotal).toContain("<cbc:ID>1000</cbc:ID>");
    expect(taxTotal).toContain("<cbc:ID>9997</cbc:ID>");
    // El IGV del documento es el de las gravadas solamente — 18.00, no 25.63 (168/1.18*0.18),
    // que es lo que salía cuando el total se descomponía como si todo fuera gravado.
    expect(taxTotal).toContain('<cbc:TaxAmount currencyID="PEN">18.00</cbc:TaxAmount>');

    // LineExtensionAmount del documento = suma de las tres bases, no solo la gravada.
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="PEN">150.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="PEN">168.00</cbc:TaxInclusiveAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="PEN">168.00</cbc:PayableAmount>');
  });

  test("un comprobante en cero igual declara un subtotal (el neutro gravado)", () => {
    const xml = generateInvoiceXML(payloadWith([{ description: "Muestra", quantity: 1, unitPriceWithTax: 0 }]));
    expect(documentTaxTotal(xml)).toContain("<cac:TaxSubtotal>");
  });
});

describe("generateInvoiceXML — unidad de medida", () => {
  test("la unidad del producto llega al XML, no siempre NIU", () => {
    const xml = generateInvoiceXML(
      payloadWith([{ description: "Tela toalla", quantity: 3.5, unitPriceWithTax: 14, unitCode: "MTR" }]),
    );
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="MTR">3.500</cbc:InvoicedQuantity>');
  });

  test("sin unidad explícita sigue siendo NIU", () => {
    const xml = generateInvoiceXML(payloadWith([{ description: "Polo", quantity: 1, unitPriceWithTax: 50 }]));
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="NIU">1.000</cbc:InvoicedQuantity>');
  });
});
