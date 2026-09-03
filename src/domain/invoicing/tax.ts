import {
  DEFAULT_TAX_AFFECTATION,
  IGV_RATE,
  resolveTaxAffectation,
  type TaxAffectationCode,
} from "./tax-affectation";

export { IGV_RATE };

export interface TaxBreakdown {
  taxedAmount: number;
  exemptAmount: number;
  unaffectedAmount: number;
  igvAmount: number;
}

/** Valor de venta de la línea: la base imponible, cualquiera sea su afectación. Es lo que va en
 *  `cbc:LineExtensionAmount`, y sumado, en el `LineExtensionAmount` del total del documento. */
export function lineValue(breakdown: TaxBreakdown): number {
  return round2(breakdown.taxedAmount + breakdown.exemptAmount + breakdown.unaffectedAmount);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Perú: los precios de catálogo ya incluyen IGV (práctica estándar en venta al consumidor final),
 * así que el desglose se calcula hacia atrás desde el total, nunca se suma aparte.
 *
 * La afectación decide en cuál de los tres baldes cae el importe, y SUNAT los exige reportados por
 * separado. Para exonerado e inafecto no hay nada que "descomponer": el total ES la base, y el IGV
 * es cero — restarle un 18% inexistente es exactamente el bug que este parámetro viene a cerrar.
 *
 * El default gravado mantiene el comportamiento de todos los llamadores que no conocen afectación
 * (el QR, el PDF de respaldo) idéntico a antes de que este parámetro existiera.
 */
export function calculateTaxBreakdown(
  totalAmount: number,
  affectationCode: string = DEFAULT_TAX_AFFECTATION,
): TaxBreakdown {
  const affectation = resolveTaxAffectation(affectationCode);

  if (affectation.rate === 0) {
    const amount = round2(totalAmount);
    return affectation.code === "20"
      ? { taxedAmount: 0, exemptAmount: amount, unaffectedAmount: 0, igvAmount: 0 }
      : { taxedAmount: 0, exemptAmount: 0, unaffectedAmount: amount, igvAmount: 0 };
  }

  const taxedAmount = round2(totalAmount / (1 + affectation.rate));
  const igvAmount = round2(totalAmount - taxedAmount);
  return { taxedAmount, igvAmount, exemptAmount: 0, unaffectedAmount: 0 };
}

/**
 * Agrega los desgloses de todas las líneas de un comprobante.
 *
 * Se suman los importes YA redondeados de cada línea, no se recalcula sobre el total: es la única
 * forma de que la cabecera del comprobante cuadre exactamente con la suma de sus líneas, que es
 * contra lo que SUNAT valida el documento. Recalcular sobre el total puede diferir un céntimo del
 * detalle y eso es un rechazo, no una diferencia cosmética.
 */
export function sumTaxBreakdowns(breakdowns: TaxBreakdown[]): TaxBreakdown {
  return breakdowns.reduce<TaxBreakdown>(
    (acc, b) => ({
      taxedAmount: round2(acc.taxedAmount + b.taxedAmount),
      exemptAmount: round2(acc.exemptAmount + b.exemptAmount),
      unaffectedAmount: round2(acc.unaffectedAmount + b.unaffectedAmount),
      igvAmount: round2(acc.igvAmount + b.igvAmount),
    }),
    { taxedAmount: 0, exemptAmount: 0, unaffectedAmount: 0, igvAmount: 0 },
  );
}

export type { TaxAffectationCode };
