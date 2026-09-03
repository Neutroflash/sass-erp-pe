import { describe, expect, test } from "bun:test";
import { calculateTaxBreakdown, lineValue, sumTaxBreakdowns } from "./tax";
import { EXONERADO, GRAVADO, INAFECTO } from "./tax-affectation";

describe("calculateTaxBreakdown", () => {
  test("descompone un total con IGV incluido (18%)", () => {
    const result = calculateTaxBreakdown(118);
    expect(result.taxedAmount).toBeCloseTo(100, 2);
    expect(result.igvAmount).toBeCloseTo(18, 2);
    expect(result.exemptAmount).toBe(0);
    expect(result.unaffectedAmount).toBe(0);
  });

  test("taxedAmount + igvAmount siempre reconstruye el total original (sin perder centavos por redondeo)", () => {
    // Casos elegidos a propósito por ser "feos" para redondear (100.10, precio típico de este
    // proyecto en los datos de prueba usados durante toda la sesión).
    for (const total of [100.1, 0.01, 1, 999.99, 1234.56]) {
      const { taxedAmount, igvAmount } = calculateTaxBreakdown(total);
      expect(Math.round((taxedAmount + igvAmount) * 100) / 100).toBeCloseTo(total, 2);
    }
  });

  test("un total de 0 no rompe nada", () => {
    const result = calculateTaxBreakdown(0);
    expect(result.taxedAmount).toBe(0);
    expect(result.igvAmount).toBe(0);
  });

  test("sin afectación explícita se comporta como gravado (el default de siempre)", () => {
    expect(calculateTaxBreakdown(118)).toEqual(calculateTaxBreakdown(118, GRAVADO));
  });

  // El bug que motivó todo esto: un producto exonerado facturado como gravado le cobra al cliente
  // un 18% que no existe y declara ante SUNAT una base imponible que el negocio no tiene.
  test("exonerado: el total ES la base, no se le extrae ningún IGV", () => {
    const result = calculateTaxBreakdown(118, EXONERADO);
    expect(result.exemptAmount).toBe(118);
    expect(result.igvAmount).toBe(0);
    expect(result.taxedAmount).toBe(0);
    expect(result.unaffectedAmount).toBe(0);
  });

  test("inafecto: mismo cero de IGV que exonerado, pero en su propio balde", () => {
    const result = calculateTaxBreakdown(118, INAFECTO);
    expect(result.unaffectedAmount).toBe(118);
    expect(result.exemptAmount).toBe(0);
    expect(result.taxedAmount).toBe(0);
    expect(result.igvAmount).toBe(0);
  });

  test("un código fuera del catálogo cae a gravado, no a IGV cero", () => {
    // Declarar de más se corrige con una nota; declarar de menos es una omisión de impuesto.
    // Si alguna vez entra basura a la columna, el error seguro es cobrar el IGV.
    expect(calculateTaxBreakdown(118, "99")).toEqual(calculateTaxBreakdown(118, GRAVADO));
  });
});

describe("sumTaxBreakdowns", () => {
  test("un comprobante con líneas gravadas y exoneradas mantiene las bases separadas", () => {
    const gravada = calculateTaxBreakdown(118, GRAVADO);
    const exonerada = calculateTaxBreakdown(50, EXONERADO);

    const total = sumTaxBreakdowns([gravada, exonerada]);

    expect(total.taxedAmount).toBeCloseTo(100, 2);
    expect(total.igvAmount).toBeCloseTo(18, 2);
    expect(total.exemptAmount).toBe(50);
    // Lo que importa: el IGV es 18, no 25.63 (= 168 / 1.18 * 0.18), que es lo que salía cuando
    // todo el comprobante se descomponía desde el total como si fuera gravado.
    expect(lineValue(total)).toBeCloseTo(150, 2);
  });

  test("la suma de líneas cuadra con el total del comprobante", () => {
    const lineas = [100.1, 33.33, 7.77].map((t) => calculateTaxBreakdown(t));
    const total = sumTaxBreakdowns(lineas);
    expect(Math.round((lineValue(total) + total.igvAmount) * 100) / 100).toBeCloseTo(141.2, 2);
  });

  test("sumar cero desgloses da el neutro, no NaN", () => {
    expect(sumTaxBreakdowns([])).toEqual({ taxedAmount: 0, exemptAmount: 0, unaffectedAmount: 0, igvAmount: 0 });
  });
});
