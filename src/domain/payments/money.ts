/**
 * Aritmética de dinero en céntimos enteros.
 *
 * El resto del proyecto redondea a dos decimales en cada paso (`Math.round(n * 100) / 100`), que
 * alcanza para calcular un total. Repartir un abono es otra cosa: se resta un monto contra varias
 * deudas en cadena, y el residuo de cada paso alimenta al siguiente. Con floats, un reparto de
 * S/ 100 entre tres ventas puede dejar un saldo de 0.004 que nunca llega a cero y un pedido que
 * jamás se cierra, o al revés, cerrar uno cobrando un céntimo de más.
 *
 * En céntimos enteros eso no puede pasar: toda la aritmética del reparto es exacta, y la
 * conversión a decimal ocurre una sola vez, al escribir a la base.
 */

export function toCents(value: unknown): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
