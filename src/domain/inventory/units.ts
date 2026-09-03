/**
 * Catálogo 03 de SUNAT — unidad de medida. Ya existía como `unitCode` en `DispatchGuideItem`;
 * acá se vuelve un concepto de primera clase porque el producto es quien la define: un negocio
 * que vende telas factura por METRO, no por unidad, y el XML tiene que decirlo.
 *
 * Subconjunto a propósito: el catálogo completo tiene cientos de códigos y ninguno de los que
 * faltan aplica a un retail/mayorista. Agregar uno es una línea; ofrecerlos todos en un `select`
 * es hacerle el trabajo más difícil a quien carga el producto.
 */
export const UNIT_CODES = {
  NIU: "Unidad",
  MTR: "Metro",
  MTK: "Metro cuadrado",
  KGM: "Kilogramo",
  GRM: "Gramo",
  LTR: "Litro",
  BX: "Caja",
  PK: "Paquete",
  ZZ: "Servicio",
} as const;

export type UnitCode = keyof typeof UNIT_CODES;

export const DEFAULT_UNIT_CODE: UnitCode = "NIU";

export function isUnitCode(value: string): value is UnitCode {
  return Object.prototype.hasOwnProperty.call(UNIT_CODES, value);
}

/** Nunca falla: un código desconocido en la base se muestra tal cual en vez de romper la página. */
export function unitLabel(code: string): string {
  return isUnitCode(code) ? UNIT_CODES[code] : code;
}

/** Abreviatura para tablas y tickets, donde "Metro" no entra. */
export const UNIT_SHORT: Record<UnitCode, string> = {
  NIU: "und",
  MTR: "m",
  MTK: "m²",
  KGM: "kg",
  GRM: "g",
  LTR: "L",
  BX: "caja",
  PK: "paq",
  ZZ: "serv",
};

export function unitShort(code: string): string {
  return isUnitCode(code) ? UNIT_SHORT[code] : code;
}
