/**
 * Cuándo hace falta identificar al comprador en un comprobante.
 *
 * Hasta ahora el sistema exigía SIEMPRE un documento (DNI, RUC, CE o pasaporte), y eso deja fuera
 * el caso más común del mostrador: una venta chica a alguien que no da su DNI, o a quien no se le
 * pide porque se le conoce. Un negocio que fía a clientes de barrio choca con esto en la primera
 * venta.
 *
 * La regla real en Perú:
 *
 * - **Factura**: siempre exige el RUC del comprador. No hay excepción.
 * - **Boleta hasta S/ 700**: puede emitirse sin identificar al comprador (tipo de documento "0"
 *   del catálogo 06 de SUNAT).
 * - **Boleta por más de S/ 700**: exige identificar al comprador con su documento.
 *
 * El umbral vive acá como constante con nombre y no incrustado en una condición, porque es un
 * número de la norma y puede cambiar sin que cambie nada de la lógica que lo usa.
 */

export const BOLETA_IDENTIFICATION_THRESHOLD_PEN = 700;

/** Tipos de documento del comprador que acepta el sistema. "SIN_DOCUMENTO" mapea al código "0". */
export const BUYER_DOCUMENT_TYPES = ["SIN_DOCUMENTO", "DNI", "RUC", "CE", "PASAPORTE"] as const;

export type BuyerDocumentType = (typeof BUYER_DOCUMENT_TYPES)[number];

/**
 * Número que se persiste y se envía cuando no se identifica al comprador. SUNAT espera un valor,
 * no un campo vacío, y "0" es el que corresponde al tipo de documento "0".
 */
export const UNIDENTIFIED_DOCUMENT_NUMBER = "0";

export interface BuyerIdentificationInput {
  type: "BOLETA" | "FACTURA";
  documentType: BuyerDocumentType;
  totalAmount: number;
}

/**
 * Devuelve el motivo por el que esta combinación NO es válida, o `null` si lo es.
 *
 * Devuelve el mensaje en vez de un booleano a propósito: quien lo llama tiene que poder decirle al
 * usuario *por qué* le falta el documento, y las dos razones (es factura / supera el umbral) piden
 * acciones distintas.
 */
export function validateBuyerIdentification(input: BuyerIdentificationInput): string | null {
  if (input.type === "FACTURA") {
    return input.documentType === "RUC" ? null : "Una factura exige el RUC del comprador.";
  }

  if (input.documentType !== "SIN_DOCUMENTO") return null;

  if (input.totalAmount > BOLETA_IDENTIFICATION_THRESHOLD_PEN) {
    return (
      `Una boleta por más de S/ ${BOLETA_IDENTIFICATION_THRESHOLD_PEN} exige identificar al comprador. ` +
      `Pide su DNI para emitirla.`
    );
  }

  return null;
}
