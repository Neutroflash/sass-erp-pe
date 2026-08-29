export interface NoteReason {
  code: string;
  label: string;
}

/** Catálogo 09 de SUNAT — tipo de nota de crédito. Lista pública, no confidencial (a diferencia
 * de las credenciales de un tenant, esto es información de referencia igual de segura de
 * hardcodear que el catálogo 01/06 ya usados en types.ts/xml-builder.ts). */
export const CREDIT_NOTE_REASONS: NoteReason[] = [
  { code: "01", label: "Anulación de la operación" },
  { code: "02", label: "Anulación por error en el RUC" },
  { code: "03", label: "Corrección por error en la descripción" },
  { code: "04", label: "Descuento global" },
  { code: "05", label: "Descuento por ítem" },
  { code: "06", label: "Devolución total" },
  { code: "07", label: "Devolución por ítem" },
  { code: "08", label: "Bonificación" },
  { code: "09", label: "Disminución en el valor" },
  { code: "10", label: "Otros conceptos" },
];

/** Catálogo 10 de SUNAT — tipo de nota de débito. */
export const DEBIT_NOTE_REASONS: NoteReason[] = [
  { code: "01", label: "Intereses por mora" },
  { code: "02", label: "Aumento en el valor" },
  { code: "03", label: "Penalidades / otros conceptos" },
  { code: "10", label: "Otros cargos" },
];

export function findNoteReason(type: "NOTA_CREDITO" | "NOTA_DEBITO", code: string): NoteReason | undefined {
  const catalog = type === "NOTA_CREDITO" ? CREDIT_NOTE_REASONS : DEBIT_NOTE_REASONS;
  return catalog.find((r) => r.code === code);
}

/**
 * La serie de una nota depende de qué tipo de documento corrige — no es fija como B001/F001 de
 * Boleta/Factura. Convención SUNAT: "FC01"/"FD01" para notas sobre una Factura, "BC01"/"BD01"
 * sobre una Boleta. Dos negocios que corrigen distinto tipo de documento nunca comparten
 * secuencia — ver el comentario en schema.prisma sobre por qué InvoiceCounter incluye `series` en
 * su clave.
 */
export function resolveNoteSeries(noteType: "NOTA_CREDITO" | "NOTA_DEBITO", relatedType: "BOLETA" | "FACTURA"): string {
  const base = relatedType === "FACTURA" ? "F" : "B";
  const suffix = noteType === "NOTA_CREDITO" ? "C01" : "D01";
  return `${base}${suffix}`;
}
