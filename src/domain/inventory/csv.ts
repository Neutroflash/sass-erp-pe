/**
 * Parser de CSV mínimo pero correcto — lo que exporta un Excel peruano, no lo que dice el RFC.
 *
 * Sin librería a propósito: las que valen la pena traen streaming, transformaciones y detección de
 * tipos que no necesitamos, y las que no, fallan exactamente en los casos que sí importan acá.
 * Los casos reales que este parser sí cubre, todos vistos en exports de Excel/LibreOffice en
 * español:
 *
 * - **Separador `;`**: Excel en configuración regional española/peruana exporta con punto y coma,
 *   porque la coma es el separador decimal. Un parser que asume `,` convierte cada fila en una
 *   sola columna gigante y "no importó nada" sin decir por qué.
 * - **BOM UTF-8**: Excel lo escribe al inicio del archivo. Sin quitarlo, la primera cabecera pasa
 *   a llamarse "﻿codigo" y no matchea con nada.
 * - **Comillas**: un nombre con el separador adentro ("Tela toalla, estampada") viene entrecomillado,
 *   y `""` adentro es una comilla literal.
 * - **CRLF** y última línea sin salto.
 */

export interface CsvTable {
  /** Cabeceras tal cual venían, sin normalizar. */
  headers: string[];
  /** Una fila por registro; cada una alineada a `headers` por posición. */
  rows: string[][];
  delimiter: string;
}

const CANDIDATE_DELIMITERS = [";", ",", "\t", "|"];

/**
 * Elige el separador contando ocurrencias FUERA de comillas en la primera línea. Contar a ciegas
 * elige mal en cuanto un nombre de producto trae una coma.
 */
function detectDelimiter(firstLine: string): string {
  let best = ",";
  let bestCount = 0;
  for (const candidate of CANDIDATE_DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === candidate && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLineEnd = clean.indexOf("\n");
  const delimiter = detectDelimiter(firstLineEnd === -1 ? clean : clean.slice(0, firstLineEnd));

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        // `""` dentro de un campo entrecomillado es una comilla literal, no el cierre.
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Último campo/registro: solo si hay algo, para no inventar una fila vacía cuando el archivo
  // termina con un salto de línea (que es lo normal).
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [], delimiter };

  const [headers, ...rows] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows, delimiter };
}

/**
 * Normaliza una cabecera para poder matchearla sin pelear con tildes, mayúsculas ni puntuación:
 * "Cód. Interno", "COD INTERNO" y "codigo_interno" tienen que llegar todos al mismo lugar. Quien
 * exporta un CSV desde su sistema viejo no va a renombrar columnas para que le calcen.
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
