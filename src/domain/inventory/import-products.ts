import { parseCsv, normalizeHeader } from "./csv";
import { DEFAULT_UNIT_CODE, UNIT_CODES, isUnitCode, type UnitCode } from "./units";
import { QTY_SCALE } from "./quantity";
import {
  DEFAULT_TAX_AFFECTATION,
  EXONERADO,
  GRAVADO,
  TAX_AFFECTATIONS,
  isTaxAffectationCode,
} from "@/domain/invoicing/tax-affectation";

/**
 * Importación de inventario desde un CSV exportado de otro sistema.
 *
 * El caso que motiva esto no es "cargar productos en lote", es **migrar un negocio que ya opera**.
 * Eso cambia el diseño en tres puntos concretos:
 *
 * 1. **Las columnas son del sistema viejo, no las nuestras.** Nadie va a renombrar 200 filas para
 *    que le calcen a nuestro esquema, así que cada campo acepta varios alias reales ("Cód.
 *    Interno", "P.Público", "Tiene IGV") además del nombre canónico.
 * 2. **Todo o nada.** Se valida el archivo completo ANTES de escribir una sola fila. Un import a
 *    medias sobre un inventario real es peor que uno que falla: deja al negocio sin saber qué
 *    quedó cargado y qué no.
 * 3. **El stock negativo no aborta el import.** Un sistema que permite vender sin existencias
 *    acumula saldos negativos (los `-25`, `-50.5` del inventario que motivó esto). Rechazar esas
 *    filas dejaría al negocio sin poder migrar justamente los productos que más mueve. Entran en
 *    cero y se reportan una por una — el saldo real se corrige con un conteo físico, que es la
 *    única forma honesta de resolverlo.
 */

export interface ImportedVariant {
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  unitCode: string;
  taxAffectationCode: string;
}

export interface ImportedProduct {
  name: string;
  categoryName?: string;
  variants: ImportedVariant[];
}

export interface ImportIssue {
  /** Número de línea del archivo tal como lo ve el usuario en Excel (1 = cabecera). */
  line: number;
  column?: string;
  message: string;
}

export interface ImportResult {
  products: ImportedProduct[];
  /** Impiden importar: nada se escribe si hay al menos uno. */
  errors: ImportIssue[];
  /** El import sigue, pero el usuario tiene que saberlo (stock negativo, unidad desconocida). */
  warnings: ImportIssue[];
  totalRows: number;
}

/**
 * Alias reales de cada columna, ya normalizados con `normalizeHeader`, **en orden de prioridad**:
 * gana el primero que aparezca en el archivo, no la primera columna del archivo que matchee alguno.
 *
 * El orden importa de verdad. Un export típico trae a la vez `ID` (el identificador interno de la
 * base del otro sistema) y `Cód. Interno` (el código con el que el negocio realmente pide y busca
 * el producto). Quedarse con el primero que aparezca en el archivo elige `ID` por venir antes, y
 * el negocio termina con SKUs que no reconoce. Por eso `id` va último de todos: es el alias más
 * genérico y el que peor identifica a un producto.
 */
const COLUMN_ALIASES = {
  sku: ["codinterno", "codigointerno", "codigo", "sku", "cod", "id"],
  name: ["nombre", "descripcion", "articulo", "item", "producto"],
  // Agrupa varias filas bajo un mismo producto — es lo que convierte 40 estampados sueltos en un
  // producto con 40 variantes. Ausente = cada fila es su propio producto, que es el caso simple.
  group: ["grupo", "productopadre", "agrupador", "familia"],
  unit: ["unidad", "unidadmedida", "um", "medida"],
  stock: ["stock", "existencia", "existencias", "cantidad", "saldo"],
  price: ["precio", "ppublico", "preciopublico", "precioventa", "pventa", "venta"],
  cost: ["costo", "preciocosto", "pcosto", "costounitario"],
  affectation: ["afectacion", "igv", "tieneigv", "tieneigvventa", "afectacionigv"],
  category: ["categoria", "rubro", "linea"],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

function mapColumns(headers: string[]): Partial<Record<ColumnKey, number>> {
  const mapping: Partial<Record<ColumnKey, number>> = {};
  const normalized = headers.map(normalizeHeader);

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [ColumnKey, readonly string[]][]) {
    // Recorre los ALIAS en orden (no las columnas): el alias más específico que exista en el
    // archivo gana, aunque su columna esté más a la derecha que la de un alias genérico.
    for (const alias of aliases) {
      const index = normalized.indexOf(alias);
      if (index !== -1) {
        mapping[key] = index;
        break;
      }
    }
  }
  return mapping;
}

/**
 * Convierte un número tal como lo escribe un Excel en español: "S/ 1,234.50", "14,5", "1.234,50".
 *
 * La ambigüedad real es la coma. Si hay coma Y punto, el que aparece último es el decimal y el
 * otro es separador de miles. Si hay solo coma, es decimal ("14,5" = 14.5) — un CSV con separador
 * `;` que trae "1,234" casi nunca quiere decir mil doscientos treinta y cuatro en un precio de
 * retail peruano.
 */
export function parseDecimal(raw: string): number | null {
  const cleaned = raw.trim().replace(/^S\/\.?/i, "").replace(/\s/g, "");
  if (cleaned === "") return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = cleaned.replace(",", ".");
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Acepta el código del catálogo ("MTR") o la etiqueta que ve el usuario ("Metros", "metro"). */
export function parseUnit(raw: string): UnitCode | null {
  const value = raw.trim();
  if (value === "") return DEFAULT_UNIT_CODE;

  const upper = value.toUpperCase();
  if (isUnitCode(upper)) return upper;

  // El sistema del que se migra exporta el plural ("Metros", "Unidades") y el catálogo guarda el
  // singular. El plural español no es solo "+s" —"unidad" hace "unidades", "caja" hace "cajas"—
  // así que en vez de intentar singularizar bien se comparan las tres formas posibles del valor
  // recibido contra la etiqueta; con un catálogo de nueve unidades es de sobra.
  const normalized = normalizeHeader(value);
  const candidates = new Set([normalized, normalized.replace(/s$/, ""), normalized.replace(/es$/, "")]);
  for (const [code, label] of Object.entries(UNIT_CODES)) {
    if (candidates.has(normalizeHeader(label))) return code as UnitCode;
  }
  return null;
}

/**
 * Acepta el código del catálogo 07 ("20"), la etiqueta ("Exonerado"), o el Sí/No de una columna
 * "Tiene IGV" — que es como lo modela el sistema del que se migra, y traducirlo a mano fila por
 * fila sería la parte más aburrida y más fácil de equivocar de toda la migración.
 */
export interface ParsedAffectation {
  code: string;
  /** El valor era un Sí/No, no una afectación nombrada — ver `parseAffectation`. */
  inferredFromBoolean: boolean;
}

export function parseAffectation(raw: string): ParsedAffectation | null {
  const value = raw.trim();
  if (value === "") return { code: DEFAULT_TAX_AFFECTATION, inferredFromBoolean: false };
  if (isTaxAffectationCode(value)) return { code: value, inferredFromBoolean: false };

  const normalized = normalizeHeader(value);

  // Un "No" en una columna "Tiene IGV" NO dice cuál de las dos afectaciones sin IGV es. Se asume
  // exonerado por ser la común en retail, pero se marca: la diferencia entre exonerado (dentro del
  // ámbito del IGV, tasa cero) e inafecto (fuera del ámbito) es una calificación legal del
  // producto, no algo derivable de un booleano. Peor todavía, en muchos sistemas ese "No"
  // significa "acá no discrimino IGV" y no que el bien esté exonerado de verdad.
  if (["si", "s", "true", "1"].includes(normalized)) return { code: GRAVADO, inferredFromBoolean: true };
  if (["no", "n", "false", "0"].includes(normalized)) return { code: EXONERADO, inferredFromBoolean: true };

  if (["gravado", "gravada"].includes(normalized)) return { code: GRAVADO, inferredFromBoolean: false };
  if (["exonerado", "exonerada"].includes(normalized)) return { code: EXONERADO, inferredFromBoolean: false };
  if (["inafecto", "inafecta"].includes(normalized)) return { code: "30", inferredFromBoolean: false };

  for (const affectation of Object.values(TAX_AFFECTATIONS)) {
    if (normalizeHeader(affectation.label).startsWith(normalized)) {
      return { code: affectation.code, inferredFromBoolean: false };
    }
  }
  return null;
}

const MAX_ROWS = 5000;

export function parseInventoryCsv(text: string): ImportResult {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const { headers, rows } = parseCsv(text);

  if (headers.length === 0) {
    return { products: [], errors: [{ line: 1, message: "El archivo está vacío" }], warnings, totalRows: 0 };
  }

  const columns = mapColumns(headers);
  for (const required of ["sku", "name", "price"] as const) {
    if (columns[required] === undefined) {
      const aliases = COLUMN_ALIASES[required].join(", ");
      errors.push({ line: 1, message: `Falta la columna de ${required === "sku" ? "código" : required === "name" ? "nombre" : "precio"}. Nombres aceptados: ${aliases}` });
    }
  }
  if (errors.length > 0) return { products: [], errors, warnings, totalRows: rows.length };

  if (rows.length > MAX_ROWS) {
    return {
      products: [],
      errors: [{ line: 1, message: `El archivo tiene ${rows.length} filas; el máximo por importación es ${MAX_ROWS}. Pártelo en varios archivos.` }],
      warnings,
      totalRows: rows.length,
    };
  }

  const cell = (row: string[], key: ColumnKey): string => {
    const index = columns[key];
    return index === undefined ? "" : (row[index] ?? "").trim();
  };

  // Agrupa por nombre de producto conservando el orden de aparición: el resultado sale en el mismo
  // orden que el archivo, que es como el usuario va a revisarlo contra su lista original.
  const grouped = new Map<string, ImportedProduct>();
  const seenSkus = new Map<string, number>();
  let inferredNonGravado = 0;

  rows.forEach((row, index) => {
    const line = index + 2; // +1 por la cabecera, +1 porque Excel cuenta desde 1

    const sku = cell(row, "sku");
    const name = cell(row, "name");

    if (sku === "") {
      errors.push({ line, column: "código", message: "Fila sin código" });
      return;
    }
    if (name === "") {
      errors.push({ line, column: "nombre", message: `El código "${sku}" no tiene nombre` });
      return;
    }

    const duplicateOf = seenSkus.get(sku.toLowerCase());
    if (duplicateOf !== undefined) {
      errors.push({ line, column: "código", message: `El código "${sku}" ya aparece en la línea ${duplicateOf}` });
      return;
    }
    seenSkus.set(sku.toLowerCase(), line);

    const price = parseDecimal(cell(row, "price"));
    if (price === null) {
      errors.push({ line, column: "precio", message: `"${sku}": precio vacío o ilegible ("${cell(row, "price")}")` });
      return;
    }
    if (price < 0) {
      errors.push({ line, column: "precio", message: `"${sku}": el precio no puede ser negativo` });
      return;
    }

    const rawCost = cell(row, "cost");
    const cost = rawCost === "" ? 0 : parseDecimal(rawCost);
    if (cost === null || cost < 0) {
      errors.push({ line, column: "costo", message: `"${sku}": costo ilegible ("${rawCost}")` });
      return;
    }

    const rawStock = cell(row, "stock");
    const parsedStock = rawStock === "" ? 0 : parseDecimal(rawStock);
    if (parsedStock === null) {
      errors.push({ line, column: "stock", message: `"${sku}": stock ilegible ("${rawStock}")` });
      return;
    }

    let stock = parsedStock;
    if (stock < 0) {
      warnings.push({
        line,
        column: "stock",
        message: `"${sku}": stock negativo (${parsedStock}) — se cargó en 0. Corrígelo con un conteo físico desde el Kardex.`,
      });
      stock = 0;
    }
    stock = Math.round(stock * 10 ** QTY_SCALE) / 10 ** QTY_SCALE;

    const rawUnit = cell(row, "unit");
    let unitCode = parseUnit(rawUnit);
    if (unitCode === null) {
      warnings.push({ line, column: "unidad", message: `"${sku}": unidad "${rawUnit}" desconocida — se usó Unidad (NIU).` });
      unitCode = DEFAULT_UNIT_CODE;
    }

    const rawAffectation = cell(row, "affectation");
    const affectation = parseAffectation(rawAffectation);
    let taxAffectationCode: string = DEFAULT_TAX_AFFECTATION;
    if (affectation === null) {
      warnings.push({ line, column: "igv", message: `"${sku}": afectación "${rawAffectation}" desconocida — se usó Gravado (IGV 18%).` });
    } else {
      taxAffectationCode = affectation.code;
      if (affectation.inferredFromBoolean && affectation.code !== DEFAULT_TAX_AFFECTATION) inferredNonGravado++;
    }

    const groupName = cell(row, "group") || name;
    const categoryName = cell(row, "category") || undefined;

    const existing = grouped.get(groupName.toLowerCase());
    const variant: ImportedVariant = { sku, name, price, costPrice: cost, stock, unitCode, taxAffectationCode };

    if (existing) {
      existing.variants.push(variant);
    } else {
      grouped.set(groupName.toLowerCase(), { name: groupName, categoryName, variants: [variant] });
    }
  });

  // Una sola advertencia, no una por fila: con 200 productos exonerados el usuario necesita ver el
  // hecho, no doscientas veces la misma línea.
  if (inferredNonGravado > 0) {
    warnings.push({
      line: 1,
      column: "igv",
      message:
        `${inferredNonGravado} ${inferredNonGravado === 1 ? "producto se importó" : "productos se importaron"} como Exonerado ` +
        `porque la columna de IGV decía "No". Verifica que corresponda: si tu sistema anterior solo no discriminaba el IGV, ` +
        `estos productos son gravados y hay que corregirlos antes de emitir comprobantes.`,
    });
  }

  return { products: [...grouped.values()], errors, warnings, totalRows: rows.length };
}
