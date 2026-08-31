import { describe, expect, test } from "bun:test";
import { montoEnLetras } from "./amount-to-words";

describe("montoEnLetras", () => {
  test("caso real usado en la sesión de verificación en vivo (100.10)", () => {
    expect(montoEnLetras(100.1)).toBe("SON CIEN CON 10/100 SOLES");
  });

  test("cero exacto", () => {
    expect(montoEnLetras(0)).toBe("SON CERO CON 00/100 SOLES");
  });

  test("uno (caso especial: UN, no UNO, al ser la unidad exacta)", () => {
    expect(montoEnLetras(1)).toBe("SON UN CON 00/100 SOLES");
  });

  test("veintiuno usa el prefijo pegado VEINTI, no VEINTE Y UNO", () => {
    expect(montoEnLetras(21)).toBe("SON VEINTIUNO CON 00/100 SOLES");
  });

  test("cien exacto usa CIEN, no CIENTO", () => {
    expect(montoEnLetras(100)).toBe("SON CIEN CON 00/100 SOLES");
  });

  test("ciento uno sí usa CIENTO (no es el caso especial)", () => {
    expect(montoEnLetras(101)).toBe("SON CIENTO UNO CON 00/100 SOLES");
  });

  test("mil exacto", () => {
    expect(montoEnLetras(1000)).toBe("SON MIL CON 00/100 SOLES");
  });

  test("un millón exacto", () => {
    expect(montoEnLetras(1_000_000)).toBe("SON UN MILLÓN CON 00/100 SOLES");
  });

  test("número compuesto grande con miles y centenas", () => {
    expect(montoEnLetras(125430.5)).toBe("SON CIENTO VEINTICINCO MIL CUATROCIENTOS TREINTA CON 50/100 SOLES");
  });
});
