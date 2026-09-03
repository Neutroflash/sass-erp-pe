/**
 * Afectación al IGV de una línea de venta — catálogo 07 de SUNAT ("Tipo de afectación del IGV"),
 * más el esquema de impuesto del catálogo 05 que le corresponde a cada una en el XML.
 *
 * Por qué existe: hasta ahora el proyecto asumía que todo lo que vende un negocio es gravado al
 * 18%. Es falso para buena parte del comercio peruano — un negocio en el Régimen General que
 * vende productos de la lista de exonerados (Apéndice I del TUO de la Ley del IGV: muchos
 * alimentos, insumos agrícolas, libros) emite comprobantes con IGV cero y SUNAT los valida contra
 * un esquema de impuesto DISTINTO. Facturar esas líneas como gravadas no es un detalle cosmético:
 * le cobra al cliente un impuesto que no corresponde y declara ante SUNAT una base imponible que
 * el negocio no tiene.
 *
 * Solo las tres afectaciones "onerosas" (operaciones de venta normales). El catálogo 07 tiene
 * además los códigos de operaciones gratuitas (11-17, 21, 31-36), que exigen tratar el valor
 * referencial aparte del valor de venta — un flujo distinto que este proyecto no emite hoy.
 */

export type TaxAffectationCode = "10" | "20" | "30";

export interface TaxAffectation {
  code: TaxAffectationCode;
  label: string;
  /** Tasa de IGV aplicable. Exonerado e inafecto van a cero por definición, no por configuración. */
  rate: number;
  /** Catálogo 05 de SUNAT — cada afectación reporta bajo su propio esquema de impuesto. */
  taxSchemeId: string;
  taxSchemeName: string;
  taxTypeCode: string;
}

export const IGV_RATE = 0.18;

export const GRAVADO: TaxAffectationCode = "10";
export const EXONERADO: TaxAffectationCode = "20";
export const INAFECTO: TaxAffectationCode = "30";

/** El valor con el que se comportaba todo antes de que este campo existiera. */
export const DEFAULT_TAX_AFFECTATION: TaxAffectationCode = GRAVADO;

export const TAX_AFFECTATIONS: Record<TaxAffectationCode, TaxAffectation> = {
  "10": {
    code: "10",
    label: "Gravado (IGV 18%)",
    rate: IGV_RATE,
    taxSchemeId: "1000",
    taxSchemeName: "IGV",
    taxTypeCode: "VAT",
  },
  "20": {
    code: "20",
    label: "Exonerado",
    rate: 0,
    taxSchemeId: "9997",
    taxSchemeName: "EXO",
    // VAT y no FRE: exonerado sigue siendo una operación DENTRO del ámbito del IGV a la que la
    // ley le da tasa cero, a diferencia de inafecto, que está fuera del ámbito. SUNAT distingue
    // los dos casos justamente por este par (esquema 9997/VAT vs 9998/FRE).
    taxTypeCode: "VAT",
  },
  "30": {
    code: "30",
    label: "Inafecto",
    rate: 0,
    taxSchemeId: "9998",
    taxSchemeName: "INA",
    taxTypeCode: "FRE",
  },
};

/** Tupla para `z.enum()` en la frontera HTTP — mismo criterio que `unitCodeSchema`: un código
 *  libre acá es un XML rechazado por SUNAT recién al emitir, el peor momento para enterarse. */
export const TAX_AFFECTATION_CODES = ["10", "20", "30"] as const satisfies readonly TaxAffectationCode[];

/** Lista estable para poblar un `<select>` — el orden es el del catálogo, no alfabético. */
export const TAX_AFFECTATION_OPTIONS: TaxAffectation[] = [
  TAX_AFFECTATIONS["10"],
  TAX_AFFECTATIONS["20"],
  TAX_AFFECTATIONS["30"],
];

/**
 * Normaliza un código que viene de la base de datos o de un formulario. Un código desconocido cae
 * a gravado a propósito: es la afectación por defecto de cualquier venta en Perú, y es el error
 * seguro de los dos posibles — declarar de más ante SUNAT se corrige con una nota; declarar de
 * menos es una omisión de impuesto.
 */
export function resolveTaxAffectation(code?: string | null): TaxAffectation {
  return TAX_AFFECTATIONS[(code ?? "") as TaxAffectationCode] ?? TAX_AFFECTATIONS[DEFAULT_TAX_AFFECTATION];
}

export function isTaxAffectationCode(code: string): code is TaxAffectationCode {
  return code in TAX_AFFECTATIONS;
}
