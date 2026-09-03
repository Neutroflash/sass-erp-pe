"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";

const PAGE_WIDTH_MM = 80; // rollo POS-80 completo (el contenido va a 72mm, ver TicketComprobante)
const CSS_PX_PER_INCH = 96;
const MM_PER_INCH = 25.4;
/** Un par de milímetros de aire: si la altura se queda corta, el ticket se parte en dos páginas. */
const HEIGHT_SAFETY_MM = 3;

/**
 * Mide cuánto va a medir el ticket IMPRESO, no el que se ve en pantalla.
 *
 * No son lo mismo: en pantalla el ticket se muestra a 320px para que se pueda leer cómodo, y al
 * imprimir pasa a 72mm (~272px). Una columna más angosta parte más líneas, así que el ticket
 * impreso es más ALTO que el de pantalla — medir el de pantalla da de menos y el ticket termina
 * cortado en dos hojas. Por eso se le aplica el ancho y el padding reales de impresión, se mide, y
 * se revierte antes de que el navegador llegue a pintar.
 */
function measurePrintHeightMm(node: HTMLElement): number {
  node.classList.add("ticket-measuring");
  const heightPx = node.getBoundingClientRect().height;
  node.classList.remove("ticket-measuring");
  return Math.ceil((heightPx / CSS_PX_PER_INCH) * MM_PER_INCH) + HEIGHT_SAFETY_MM;
}

/**
 * Fija el tamaño de página al alto real del ticket, justo antes de imprimir.
 *
 * Esto vivía en globals.css como `@page { size: 80mm auto }` y **no funcionaba**: la gramática de
 * `size` (CSS Paged Media 3) es `<length>{1,2} | auto | <page-size>`, o sea que `auto` no se puede
 * combinar con una medida. La declaración entera era inválida, el navegador la descartaba, y el
 * ticket salía de 72mm arriba a la izquierda de una hoja A4.
 *
 * Con una altura concreta la regla es válida. Además queda EXACTA: en una térmica de rollo continuo
 * una página más alta que el ticket es papel en blanco que se alimenta y se corta de más.
 */
function withTicketPageSize(node: HTMLElement, print: () => void) {
  const style = document.createElement("style");
  style.textContent = `@page { size: ${PAGE_WIDTH_MM}mm ${measurePrintHeightMm(node)}mm; margin: 0; }`;
  document.head.appendChild(style);

  const cleanup = () => {
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  print();

  // Safari no dispara `afterprint` de forma confiable — sin esta red de seguridad la regla se
  // quedaría pegada y la siguiente impresión usaría la altura del ticket anterior.
  window.setTimeout(cleanup, 60_000);
}

/**
 * Imprimir/PDF usa el diálogo nativo del navegador (`window.print()` → "Guardar como PDF") en vez
 * de una librería — es la forma más confiable de respetar el layout exacto del ticket (CSS real,
 * sin las limitaciones de renderizado de un canvas). Exportar PNG sí necesita una librería
 * (`html-to-image`) porque no hay equivalente nativo del navegador para eso.
 */
export function TicketActions({ targetId, fileName }: { targetId: string; fileName: string }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePrint() {
    const node = document.getElementById(targetId);
    if (!node) return;
    withTicketPageSize(node, () => window.print());
  }

  async function handleExportPng() {
    const node = document.getElementById(targetId);
    if (!node) return;
    setExporting(true);
    setError(null);
    try {
      // `html-to-image` clona el nodo dentro de un <foreignObject> y lo rasteriza. Si las fuentes
      // todavía no resolvieron, ese primer rasterizado sale en blanco — y resuelve sin error, así
      // que sin esto el usuario se descarga un PNG vacío creyendo que funcionó.
      if (document.fonts?.ready) await document.fonts.ready;
      const options = { pixelRatio: 2, backgroundColor: "#ffffff" as const };
      // La primera pasada calienta la caché de estilos/fuentes de la librería; la segunda es la
      // que sale completa. Es el workaround conocido de html-to-image, no una superstición: la
      // primera invocación puede rasterizar antes de que el clon termine de resolver sus estilos.
      await toPng(node, options);
      const dataUrl = await toPng(node, options);

      assertNotBlank(dataUrl);

      const link = document.createElement("a");
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      // El ancla TIENE que estar en el documento: Chrome ignora `download` en un elemento suelto y
      // cae a descargar con el título de la página ("E-Commerce ERP Perú.png") en vez del nombre
      // del comprobante.
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar el PNG");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 print:hidden">
      <div className="flex gap-2">
        <Button size="sm" onClick={handlePrint}>
          Imprimir / Guardar PDF
        </Button>
        <Button size="sm" variant="outline" disabled={exporting} onClick={handleExportPng}>
          {exporting ? "Exportando..." : "Exportar PNG"}
        </Button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

/**
 * Falla ruidosamente si la captura salió vacía.
 *
 * Un PNG en blanco pesa muy poco comparado con uno que tiene el ticket dibujado: sin esta guarda,
 * que la librería falle es indistinguible de que funcione — se descarga un archivo válido, vacío, y
 * el usuario se entera recién al abrirlo. Es el umbral más burdo posible, y aun así es la
 * diferencia entre un error visible y un archivo mudo.
 */
function assertNotBlank(dataUrl: string) {
  const MIN_DATA_URL_LENGTH = 5_000;
  if (dataUrl.length < MIN_DATA_URL_LENGTH) {
    throw new Error("La imagen salió vacía. Usa 'Imprimir / Guardar PDF' mientras tanto.");
  }
}
