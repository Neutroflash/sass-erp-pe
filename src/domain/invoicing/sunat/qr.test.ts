import { describe, expect, test } from "bun:test";
import { buildQrContent } from "./qr";
import type { SunatInvoicePayload } from "./types";

// Bug real de esta sesión: buildQrContent solo tenía 9 campos (faltaba el Valor Resumen) desde
// que se escribió — este test existe específicamente para que ese bug no pueda volver sin que
// falle algo, ver el comentario grande en qr.ts.
describe("buildQrContent", () => {
  const payload: SunatInvoicePayload = {
    tipoDocumento: "03",
    serie: "B001",
    numero: 1,
    fechaEmision: new Date("2026-08-30T15:00:00Z"),
    emisor: { ruc: "20123456789", businessName: "Piloto SAC" },
    cliente: { documentTypeCode: "1", documentNumber: "12345678", name: "Juan Pérez" },
    lineas: [{ description: "Polo Adidas", quantity: 1, unitPriceWithTax: 100.1 }],
  };
  const documentDigest = "abc123digest==";

  test("genera exactamente 10 campos separados por |, en el orden del Anexo N°7", () => {
    const qr = buildQrContent(payload, documentDigest);
    const fields = qr.split("|");

    expect(fields).toHaveLength(10);
    expect(fields[0]).toBe("20123456789"); // RUC emisor
    expect(fields[1]).toBe("03"); // tipo de documento
    expect(fields[2]).toBe("B001"); // serie
    expect(fields[3]).toBe("1"); // número
    expect(fields[4]).toBe("15.27"); // IGV (18% de 100.10 vuelto a calcular hacia atrás)
    expect(fields[5]).toBe("100.10"); // total de venta
    expect(fields[6]).toBe("2026-08-30"); // fecha de emisión, YYYY-MM-DD
    expect(fields[7]).toBe("1"); // tipo de documento del cliente
    expect(fields[8]).toBe("12345678"); // número de documento del cliente
    expect(fields[9]).toBe(documentDigest); // Valor Resumen — el campo que faltaba
  });

  test("el total se recalcula desde las líneas, no se confía en un campo aparte", () => {
    const twoLines: SunatInvoicePayload = {
      ...payload,
      lineas: [
        { description: "A", quantity: 2, unitPriceWithTax: 10 },
        { description: "B", quantity: 1, unitPriceWithTax: 5 },
      ],
    };
    const fields = buildQrContent(twoLines, documentDigest).split("|");
    expect(fields[5]).toBe("25.00");
  });
});
