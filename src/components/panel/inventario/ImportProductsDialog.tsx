"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, AlertTriangle, CircleAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImportIssue {
  line: number;
  column?: string;
  message: string;
}

interface ImportReport {
  products: number;
  variants: number;
  rows: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  imported: boolean;
}

/** Sin `confirm`, el endpoint valida y devuelve el reporte sin escribir nada. */
async function postImport(csv: string, confirm: boolean): Promise<ImportReport> {
  const res = await fetch("/api/products/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv, confirm }),
  });
  const body = await res.json();
  // Un 400/409 acá no es un fallo de red: es el reporte de qué está mal en el archivo, que es
  // justamente lo que hay que mostrarle al usuario. Solo se lanza si ni siquiera vino un reporte.
  if (!res.ok && !Array.isArray(body?.errors)) {
    throw new Error(body?.error ?? "No se pudo procesar el archivo");
  }
  return body as ImportReport;
}

function IssueList({ issues, variant }: { issues: ImportIssue[]; variant: "error" | "warning" }) {
  const isError = variant === "error";
  const Icon = isError ? CircleAlert : AlertTriangle;
  // Un archivo con 200 filas malas no debe producir un diálogo de 200 líneas: con las primeras
  // basta para entender el patrón y corregir el archivo de una pasada.
  const shown = issues.slice(0, 15);

  return (
    <div className="flex flex-col gap-1">
      {shown.map((issue, i) => (
        <div key={i} className={cn("flex items-start gap-2 text-xs", isError ? "text-destructive" : "text-amber-500")}>
          <Icon className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {issue.line > 0 && <span className="font-medium">Línea {issue.line}: </span>}
            {issue.message}
          </span>
        </div>
      ))}
      {issues.length > shown.length && (
        <span className="text-xs text-muted-foreground">y {issues.length - shown.length} más…</span>
      )}
    </div>
  );
}

export function ImportProductsDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCsv(null);
    setFileName("");
    setReport(null);
    setError(null);
  }

  async function handleFile(file: File) {
    reset();
    setBusy(true);
    try {
      const text = await file.text();
      setCsv(text);
      setFileName(file.name);
      setReport(await postImport(text, false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!csv) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postImport(csv, true);
      setReport(result);
      if (result.imported) {
        router.refresh();
        // Se deja el diálogo abierto a propósito: las advertencias de stock negativo son lo que el
        // usuario tiene que anotar para hacer el conteo físico después. Cerrar de golpe las pierde.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar");
    } finally {
      setBusy(false);
    }
  }

  const canImport = !!report && report.errors.length === 0 && !report.imported;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar inventario</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground">
            <p className="mb-1">
              Archivo <span className="font-medium text-foreground">CSV</span> con una fila por producto. Se reconocen los
              nombres de columna del sistema del que vienes:
            </p>
            <p className="font-mono text-[11px] text-foreground/80">
              código · nombre · unidad · stock · precio · costo · IGV · categoría · grupo
            </p>
            <p className="mt-2">
              <span className="font-medium text-foreground">grupo</span> junta varias filas en un mismo producto con varias
              variantes — para telas estampadas que solo cambian de código.
            </p>
          </div>

          <label
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-border p-6 text-center transition-colors hover:border-primary/50",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-foreground">{fileName || "Elegir archivo CSV"}</span>
            <span className="text-xs text-muted-foreground">Se valida primero — nada se carga hasta que confirmes</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                // Permite volver a elegir el MISMO archivo tras corregirlo: sin esto, el input no
                // dispara change y parece que el botón dejó de funcionar.
                e.target.value = "";
              }}
            />
          </label>

          {error && <span className="text-xs text-destructive">{error}</span>}

          {report && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">
                  {report.rows} filas leídas → <span className="text-foreground">{report.products} productos</span>,{" "}
                  <span className="text-foreground">{report.variants} variantes</span>
                </span>
                {report.imported && (
                  <span className="flex items-center gap-1 font-medium text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Importado
                  </span>
                )}
              </div>

              {report.errors.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-destructive">
                    {report.errors.length} {report.errors.length === 1 ? "error" : "errores"} — corrige el archivo y vuelve a
                    subirlo
                  </span>
                  <IssueList issues={report.errors} variant="error" />
                </div>
              )}

              {report.warnings.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-amber-500">
                    {report.warnings.length} {report.warnings.length === 1 ? "advertencia" : "advertencias"} — se importa
                    igual
                  </span>
                  <IssueList issues={report.warnings} variant="warning" />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" disabled={!canImport || busy} onClick={handleConfirm}>
            {busy ? "Procesando..." : report?.imported ? "Listo" : `Importar ${report?.products ?? 0} productos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
