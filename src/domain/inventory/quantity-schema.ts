import { z } from "zod";
import { QTY_SCALE } from "./quantity";
import { UNIT_CODES, type UnitCode } from "./units";

/**
 * Validación de cantidades en la frontera HTTP.
 *
 * Antes todas estas cantidades eran `z.number().int()`. Ese `.int()` no daba error de compilación
 * al pasar las columnas a decimal — habría rechazado "3.5 metros" en tiempo de ejecución, con un
 * 400 y sin ninguna pista de por qué. Vive acá, en un solo lugar, para que no vuelva a haber seis
 * definiciones distintas de "una cantidad válida".
 */

const FACTOR = 10 ** QTY_SCALE;

/** `numeric(12,3)` admite hasta 999 999 999.999; el tope real de un negocio está muy por debajo. */
const MAX_QUANTITY = 9_999_999;

const withinScale = (n: number) => Number.isInteger(Math.round(n * FACTOR)) && Math.abs(n * FACTOR - Math.round(n * FACTOR)) < 1e-6;

const scaleMessage = `Máximo ${QTY_SCALE} decimales`;

/** Cantidad que se vende o se mueve: siempre mayor que cero. */
export const quantitySchema = z
  .number()
  .positive()
  .max(MAX_QUANTITY)
  .refine(withinScale, scaleMessage);

/** Stock o existencias: cero es válido (un producto agotado sigue existiendo). */
export const stockSchema = z
  .number()
  .nonnegative()
  .max(MAX_QUANTITY)
  .refine(withinScale, scaleMessage);

/**
 * Unidad de medida. Se valida contra el catálogo que la UI ofrece — un código libre acá
 * significaría un XML rechazado por SUNAT recién al emitir, que es el peor momento para enterarse.
 */
export const unitCodeSchema = z.enum(Object.keys(UNIT_CODES) as [UnitCode, ...UnitCode[]]);
