/**
 * Número de comprobante tal como debe leerse en una representación impresa: serie + correlativo
 * rellenado a 8 dígitos ("B001-00000002"), que es como lo espera cualquiera que haya visto una
 * boleta peruana.
 *
 * Deliberadamente NO es el formato del XML. Ahí el `cbc:ID` va sin relleno ("B001-2"), que es lo
 * que SUNAT aceptó en vivo y no se toca. Este helper existe porque el ticket y el PDF —las dos
 * representaciones impresas del MISMO comprobante— tenían cada una su propio formato y mostraban
 * números distintos para el mismo documento.
 */
export function formatNumeroComprobante(serie: string, numero: number): string {
  return `${serie}-${String(numero).padStart(8, "0")}`;
}
