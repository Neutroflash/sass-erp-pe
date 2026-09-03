/**
 * Cantidades con decimales.
 *
 * Un negocio que vende telas despacha 3.5 metros, no 3 ni 4. Las columnas son
 * `numeric(12,3)` en Postgres, así que la escala real es de tres decimales y este módulo es el
 * único lugar donde eso se decide.
 *
 * Dos reglas que vale la pena no romper:
 *
 * 1. **Comparar en milésimas enteras, no en flotantes.** `0.1 + 0.2 > 0.3` es `true` en IEEE 754
 *    y eso, en el chequeo de stock, significa vender lo que no hay. `hasEnough()` compara enteros.
 * 2. **Mandar strings a Postgres, no números.** Un `number` de JS viaja como `double precision`;
 *    al sumarlo a una columna `numeric` el resultado pasa por punto flotante antes de volver a
 *    `numeric`. `toParam()` produce el literal decimal exacto para castear con `::numeric`.
 */

export const QTY_SCALE = 3;
const FACTOR = 10 ** QTY_SCALE;

/**
 * Normaliza cualquier cosa que venga de Prisma (`Decimal`), de `$queryRaw` (string) o de un
 * formulario (string/number) a un número con la escala del sistema.
 */
export function toQty(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * FACTOR) / FACTOR;
}

/** Milésimas enteras — la representación exacta para comparar y acumular sin error de flotante. */
export function toMilli(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * FACTOR);
}

export function fromMilli(milli: number): number {
  return milli / FACTOR;
}

/** Literal decimal exacto para parámetros SQL (`${toParam(q)}::numeric`) y campos Decimal. */
export function toParam(value: unknown): string {
  return toQty(value).toFixed(QTY_SCALE);
}

/** ¿Alcanza `available` para despachar `needed`? Comparación exacta, en milésimas. */
export function hasEnough(available: unknown, needed: unknown): boolean {
  return toMilli(available) >= toMilli(needed);
}

export function addQty(a: unknown, b: unknown): number {
  return fromMilli(toMilli(a) + toMilli(b));
}

export function subQty(a: unknown, b: unknown): number {
  return fromMilli(toMilli(a) - toMilli(b));
}

/** Cantidad × precio, redondeado a céntimos — el importe de una línea. */
export function lineTotal(quantity: unknown, unitPrice: unknown): number {
  const price = typeof unitPrice === "number" ? unitPrice : Number(unitPrice);
  return Math.round(toQty(quantity) * price * 100) / 100;
}

export function isPositiveQty(value: unknown): boolean {
  return toMilli(value) > 0;
}

/**
 * Para mostrar: recorta los ceros que no aportan (`3.500` → `3.5`, `2.000` → `2`) sin perder
 * los que sí (`0.750` → `0.75`).
 */
export function formatQty(value: unknown): string {
  const fixed = toQty(value).toFixed(QTY_SCALE);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}
