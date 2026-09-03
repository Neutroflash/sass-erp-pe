import { describe, expect, test } from "bun:test";
import { parseCsv, normalizeHeader } from "./csv";
import { parseAffectation, parseDecimal, parseInventoryCsv, parseUnit } from "./import-products";

describe("parseCsv", () => {
  test("detecta el separador ';' que exporta un Excel en español", () => {
    const { headers, rows, delimiter } = parseCsv("codigo;nombre;precio\n42;Abreojal;1.50");
    expect(delimiter).toBe(";");
    expect(headers).toEqual(["codigo", "nombre", "precio"]);
    expect(rows[0]).toEqual(["42", "Abreojal", "1.50"]);
  });

  test("un nombre con coma adentro no cambia la detección del separador", () => {
    // Con conteo a ciegas, esta línea tendría más comas que puntos y coma y elegiría mal.
    const { delimiter, rows } = parseCsv('codigo;nombre;precio\n39;"Algodon estampado, liso";15.00');
    expect(delimiter).toBe(";");
    expect(rows[0][1]).toBe("Algodon estampado, liso");
  });

  test("quita el BOM que Excel escribe al inicio", () => {
    const { headers } = parseCsv("﻿codigo,nombre\n1,Aguja");
    expect(headers[0]).toBe("codigo");
  });

  test("comillas dobles escapadas dentro de un campo", () => {
    const { rows } = parseCsv('codigo,nombre\n1,"Tela 1"" ancho"');
    expect(rows[0][1]).toBe('Tela 1" ancho');
  });

  test("CRLF y última línea sin salto final", () => {
    const { rows } = parseCsv("codigo,nombre\r\n1,Aguja\r\n2,Alfiler");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["2", "Alfiler"]);
  });

  test("ignora filas totalmente vacías", () => {
    const { rows } = parseCsv("codigo,nombre\n1,Aguja\n,\n2,Alfiler\n");
    expect(rows).toHaveLength(2);
  });
});

describe("normalizeHeader", () => {
  test("tildes, mayúsculas y puntuación colapsan a la misma clave", () => {
    expect(normalizeHeader("Cód. Interno")).toBe("codinterno");
    expect(normalizeHeader("COD INTERNO")).toBe("codinterno");
    expect(normalizeHeader("cod_interno")).toBe("codinterno");
  });
});

describe("parseDecimal", () => {
  test("formatos que escribe un Excel en español", () => {
    expect(parseDecimal("14,5")).toBe(14.5);
    expect(parseDecimal("14.5")).toBe(14.5);
    expect(parseDecimal("S/ 1,234.50")).toBe(1234.5);
    expect(parseDecimal("1.234,50")).toBe(1234.5);
    expect(parseDecimal("S/14.00")).toBe(14);
    expect(parseDecimal("-50,5")).toBe(-50.5);
  });

  test("vacío e ilegible se distinguen de cero", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("   ")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("0")).toBe(0);
  });
});

describe("parseUnit", () => {
  test("acepta el código y la etiqueta, en singular o plural", () => {
    expect(parseUnit("MTR")).toBe("MTR");
    expect(parseUnit("Metros")).toBe("MTR");
    expect(parseUnit("metro")).toBe("MTR");
    expect(parseUnit("Unidades")).toBe("NIU");
    expect(parseUnit("")).toBe("NIU");
  });

  test("una unidad que no existe se reporta, no se adivina", () => {
    expect(parseUnit("bobinas")).toBeNull();
  });
});

describe("parseAffectation", () => {
  // La columna real del sistema del que se migra se llama "Tiene Igv (Venta)" y trae Sí/No.
  test("traduce el Sí/No de una columna 'Tiene IGV', marcándolo como inferido", () => {
    expect(parseAffectation("Si")).toEqual({ code: "10", inferredFromBoolean: true });
    expect(parseAffectation("Sí")).toEqual({ code: "10", inferredFromBoolean: true });
    // "No" no dice si es exonerado o inafecto — se asume exonerado pero queda marcado.
    expect(parseAffectation("No")).toEqual({ code: "20", inferredFromBoolean: true });
  });

  test("un código o etiqueta explícita no se marca como inferida", () => {
    expect(parseAffectation("20")).toEqual({ code: "20", inferredFromBoolean: false });
    expect(parseAffectation("Exonerado")).toEqual({ code: "20", inferredFromBoolean: false });
    expect(parseAffectation("Inafecto")).toEqual({ code: "30", inferredFromBoolean: false });
    expect(parseAffectation("")).toEqual({ code: "10", inferredFromBoolean: false });
  });

  test("un valor desconocido se reporta, no cae silenciosamente a gravado", () => {
    expect(parseAffectation("tal vez")).toBeNull();
  });
});

describe("parseInventoryCsv", () => {
  const cabecera = "Cód. Interno;Nombre;Unidad;Stock;P.Público;Tiene Igv (Venta)";

  test("importa una fila con las columnas del sistema viejo", () => {
    const result = parseInventoryCsv(`${cabecera}\n39;algodon estampado;Metros;12,5;S/ 15.00;No`);

    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(1);
    expect(result.products[0].variants[0]).toEqual({
      sku: "39",
      name: "algodon estampado",
      price: 15,
      costPrice: 0,
      stock: 12.5,
      unitCode: "MTR",
      taxAffectationCode: "20",
    });
  });

  // El caso que motivó todo esto: un inventario real con saldos negativos.
  test("el stock negativo entra en cero y se reporta, no bloquea la importación", () => {
    const result = parseInventoryCsv(`${cabecera}\n38;algodon llano;Metros;-18,5;S/ 14.00;No`);

    expect(result.errors).toEqual([]);
    expect(result.products[0].variants[0].stock).toBe(0);
    const stockWarnings = result.warnings.filter((w) => w.column === "stock");
    expect(stockWarnings).toHaveLength(1);
    expect(stockWarnings[0].line).toBe(2);
    expect(stockWarnings[0].message).toContain("-18.5");
  });

  // Encontrado probando con el formato crudo real: el export trae a la vez "ID" (el identificador
  // interno del otro sistema) y "Cód. Interno" (el código con el que el negocio pide el producto).
  // Quedarse con el primero que aparece en el archivo elegía "ID", y el negocio terminaba con SKUs
  // que no reconoce.
  test("con 'ID' y 'Cód. Interno' a la vez, gana el código interno aunque venga después", () => {
    const result = parseInventoryCsv(
      "ID;Cód. Interno;Unidad;Nombre;Stock;P.Público\n142;00142;Unidades;Cierre invisible;3;S/ 2,50",
    );

    expect(result.errors).toEqual([]);
    expect(result.products[0].variants[0].sku).toBe("00142");
  });

  test("con una sola columna de código, cualquiera de los alias sirve", () => {
    expect(parseInventoryCsv("ID;Nombre;Precio\n142;Cierre;2.50").products[0].variants[0].sku).toBe("142");
    expect(parseInventoryCsv("SKU;Nombre;Precio\nABC-1;Cierre;2.50").products[0].variants[0].sku).toBe("ABC-1");
  });

  test("faltar una columna obligatoria aborta antes de mirar las filas", () => {
    const result = parseInventoryCsv("nombre;unidad\nAguja;Unidades");
    expect(result.products).toEqual([]);
    expect(result.errors.some((e) => e.message.includes("código"))).toBe(true);
    expect(result.errors.some((e) => e.message.includes("precio"))).toBe(true);
  });

  test("un código repetido dentro del mismo archivo es un error, no un pisado silencioso", () => {
    const result = parseInventoryCsv(`${cabecera}\n42;Abreojal;Unidades;0;1.50;No\n42;Otro;Unidades;3;2.00;No`);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(3);
    expect(result.errors[0].message).toContain("línea 2");
  });

  test("un precio ilegible señala la línea y el código exactos", () => {
    const result = parseInventoryCsv(`${cabecera}\n96;Aguja;Unidades;5;;No`);
    expect(result.errors[0].line).toBe(2);
    expect(result.errors[0].message).toContain("96");
  });

  test("la columna 'grupo' junta varias filas en un producto con varias variantes", () => {
    // La pregunta real del cliente: estampados que solo se diferencian por código.
    const csv = [
      "codigo;nombre;grupo;unidad;stock;precio",
      "00124;Estampado floral;Tela toalla estampada;Metros;10;15.00",
      "00125;Estampado rayas;Tela toalla estampada;Metros;8;15.00",
      "38;algodon llano;;Metros;5;14.00",
    ].join("\n");

    const result = parseInventoryCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.products).toHaveLength(2);
    expect(result.products[0].name).toBe("Tela toalla estampada");
    expect(result.products[0].variants.map((v) => v.sku)).toEqual(["00124", "00125"]);
    expect(result.products[1].variants).toHaveLength(1);
  });

  test("sin columna de grupo cada fila es su propio producto", () => {
    const result = parseInventoryCsv(`${cabecera}\n42;Abreojal;Unidades;0;1.50;No\n98;Aceite;Unidades;0;5.00;No`);
    expect(result.products).toHaveLength(2);
    expect(result.products.every((p) => p.variants.length === 1)).toBe(true);
  });

  test("avisa UNA vez cuando la columna IGV decía No, no una vez por fila", () => {
    const result = parseInventoryCsv(
      `${cabecera}\n42;Abreojal;Unidades;1;1.50;No\n98;Aceite;Unidades;1;5.00;No\n96;Aguja;Unidades;1;1.00;Si`,
    );

    const igvWarnings = result.warnings.filter((w) => w.column === "igv");
    expect(igvWarnings).toHaveLength(1);
    expect(igvWarnings[0].message).toContain("2 productos");
    expect(result.products.map((p) => p.variants[0].taxAffectationCode)).toEqual(["20", "20", "10"]);
  });

  test("un archivo vacío no revienta", () => {
    expect(parseInventoryCsv("").errors[0].message).toContain("vacío");
  });
});
