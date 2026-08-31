"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";

/**
 * Imprimir/PDF usa el diálogo nativo del navegador (`window.print()` → "Guardar como PDF") en vez
 * de una librería — es la forma más confiable de respetar el layout exacto del ticket (CSS real,
 * sin las limitaciones de renderizado de un canvas). Exportar PNG sí necesita una librería
 * (`html-to-image`) porque no hay equivalente nativo del navegador para eso.
 */
export function TicketActions({ targetId, fileName }: { targetId: string; fileName: string }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExportPng() {
    const node = document.getElementById(targetId);
    if (!node) return;
    setExporting(true);
    setError(null);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar el PNG");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 print:hidden">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => window.print()}>
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
