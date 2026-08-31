import { describe, expect, test } from "bun:test";
import { calculateTaxBreakdown } from "./tax";

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
});
