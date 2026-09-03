import { describe, expect, test } from "bun:test";
import { addQty, formatQty, hasEnough, isPositiveQty, lineTotal, subQty, toParam, toQty } from "./quantity";

/**
 * Estas pruebas existen por una razón concreta: al pasar las cantidades de `integer` a
 * `numeric(12,3)`, la aritmética de JavaScript deja de ser inocente. Cada caso de acá es un
 * error que ya cometimos o que estábamos a un paso de cometer.
 */

describe("toQty", () => {
  test("normaliza lo que venga de Prisma, de SQL crudo o de un formulario", () => {
    expect(toQty(3.5)).toBe(3.5);
    expect(toQty("3.500")).toBe(3.5); // $queryRaw devuelve numeric como string
    expect(toQty("0.375")).toBe(0.375);
  });

  test("recorta a la escala real de la columna en vez de guardar basura", () => {
    expect(toQty(3.5004)).toBe(3.5);
    expect(toQty(3.5006)).toBe(3.501);
  });

  test("un valor inválido es cero, no NaN — un NaN se propaga en silencio hasta el comprobante", () => {
    expect(toQty("")).toBe(0);
    expect(toQty("abc")).toBe(0);
    expect(toQty(undefined)).toBe(0);
    expect(toQty(Infinity)).toBe(0);
  });
});

describe("sumar y restar", () => {
  test("0.1 + 0.2 da 0.3, no 0.30000000000000004", () => {
    expect(addQty(0.1, 0.2)).toBe(0.3);
  });

  test("restar no deja residuos de punto flotante", () => {
    expect(subQty(0.3, 0.1)).toBe(0.2);
    expect(subQty(12.75, 12.75)).toBe(0);
  });
});

describe("hasEnough", () => {
  test("vender exactamente lo que queda es válido", () => {
    expect(hasEnough(3.5, 3.5)).toBe(true);
  });

  test("no se vende lo que no hay, ni por una milésima", () => {
    expect(hasEnough(3.5, 3.501)).toBe(false);
  });

  test("el caso que un `>=` de flotantes se come: 0.1+0.2 disponible contra 0.3 pedido", () => {
    // Con aritmética de flotantes, 0.1 + 0.2 = 0.30000000000000004: acá daría true por accidente.
    // Con milésimas enteras da true por la razón correcta: son exactamente iguales.
    expect(hasEnough(addQty(0.1, 0.2), 0.3)).toBe(true);
  });

  test("stock en cero no alcanza para nada", () => {
    expect(hasEnough(0, 0.001)).toBe(false);
  });
});

describe("lineTotal", () => {
  test("3.5 metros a 24.90 son 87.15", () => {
    expect(lineTotal(3.5, 24.9)).toBe(87.15);
  });

  test("redondea a céntimos: no existe medio céntimo en un comprobante", () => {
    expect(lineTotal(0.375, 60)).toBe(22.5);
    expect(lineTotal(1.333, 10)).toBe(13.33);
  });
});

describe("toParam", () => {
  test("produce el literal exacto que se castea a numeric en SQL", () => {
    expect(toParam(3.5)).toBe("3.500");
    expect(toParam(0.1 + 0.2)).toBe("0.300"); // el residuo de flotante no llega a Postgres
    expect(toParam(12)).toBe("12.000");
  });
});

describe("formatQty", () => {
  test("muestra lo justo: sin ceros de relleno, sin perder decimales reales", () => {
    expect(formatQty(3.5)).toBe("3.5");
    expect(formatQty(2)).toBe("2");
    expect(formatQty(0.75)).toBe("0.75");
    expect(formatQty(0.001)).toBe("0.001");
  });
});

describe("isPositiveQty", () => {
  test("cero y negativos no son cantidades vendibles", () => {
    expect(isPositiveQty(0)).toBe(false);
    expect(isPositiveQty(-1)).toBe(false);
    expect(isPositiveQty(0.001)).toBe(true);
  });
});
