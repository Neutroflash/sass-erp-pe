import { describe, expect, test } from "bun:test";
import {
  BOLETA_IDENTIFICATION_THRESHOLD_PEN,
  validateBuyerIdentification,
} from "./buyer-identification";

const UMBRAL = BOLETA_IDENTIFICATION_THRESHOLD_PEN;

describe("validateBuyerIdentification — boleta", () => {
  // El caso que motivó todo: una venta chica de mostrador a alguien que no da su DNI. Hasta ahora
  // el sistema lo hacía imposible y el negocio no podía emitir nada.
  test("una boleta chica puede ir sin identificar al comprador", () => {
    expect(validateBuyerIdentification({ type: "BOLETA", documentType: "SIN_DOCUMENTO", totalAmount: 45 })).toBeNull();
  });

  test("justo en el umbral todavía puede ir sin documento", () => {
    expect(
      validateBuyerIdentification({ type: "BOLETA", documentType: "SIN_DOCUMENTO", totalAmount: UMBRAL }),
    ).toBeNull();
  });

  test("un céntimo por encima del umbral ya exige documento", () => {
    const error = validateBuyerIdentification({
      type: "BOLETA",
      documentType: "SIN_DOCUMENTO",
      totalAmount: UMBRAL + 0.01,
    });
    expect(error).not.toBeNull();
    expect(error).toContain("DNI");
  });

  test("con documento, el monto deja de importar", () => {
    for (const total of [10, UMBRAL, 5000]) {
      expect(validateBuyerIdentification({ type: "BOLETA", documentType: "DNI", totalAmount: total })).toBeNull();
    }
  });

  test("una boleta acepta cualquier tipo de documento, no solo DNI", () => {
    for (const documentType of ["DNI", "CE", "PASAPORTE", "RUC"] as const) {
      expect(validateBuyerIdentification({ type: "BOLETA", documentType, totalAmount: 2000 })).toBeNull();
    }
  });
});

describe("validateBuyerIdentification — factura", () => {
  test("una factura siempre exige RUC, sin importar el monto", () => {
    expect(validateBuyerIdentification({ type: "FACTURA", documentType: "RUC", totalAmount: 10 })).toBeNull();
  });

  test("una factura sin documento se rechaza aunque sea de S/ 1", () => {
    const error = validateBuyerIdentification({ type: "FACTURA", documentType: "SIN_DOCUMENTO", totalAmount: 1 });
    expect(error).toContain("RUC");
  });

  test("una factura con DNI se rechaza — el umbral no aplica acá", () => {
    expect(validateBuyerIdentification({ type: "FACTURA", documentType: "DNI", totalAmount: 50 })).toContain("RUC");
  });
});
