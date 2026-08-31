"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { issueInvoice, type IssueInvoiceInput } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CreditDebitNoteForm, type NoteSummary } from "./CreditDebitNoteForm";

const inputClass =
  "h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-zinc-100 outline-none transition-colors focus:border-primary/50";

export interface OrderInvoiceSummary {
  id: string;
  type: "BOLETA" | "FACTURA" | "NOTA_CREDITO" | "NOTA_DEBITO";
  status: "DRAFT" | "PENDING_SUNAT" | "ISSUED" | "FAILED" | "VOID";
  series: string;
  number: number;
  documentType: string;
  documentNumber: string;
  businessName: string | null;
  totalAmount: number;
  notes: NoteSummary[];
}

// Emisión manual: ningún tenant está registrado como emisor electrónico ante SUNAT todavía, así
// que esto no ocurre automáticamente al confirmarse el pago — ver domain/invoicing/gateway.ts.
export function InvoiceSection({ orderId, invoice }: { orderId: string; invoice: OrderInvoiceSummary | null }) {
  const router = useRouter();
  const [type, setType] = useState<IssueInvoiceInput["type"]>("BOLETA");
  const [documentType, setDocumentType] = useState<IssueInvoiceInput["documentType"]>("DNI");
  const [documentNumber, setDocumentNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (invoice) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Comprobante</span>
          <p className="mt-1 text-zinc-100">
            {invoice.type === "BOLETA" ? "Boleta" : "Factura"} {invoice.series}-{invoice.number}
          </p>
          <p className="text-sm text-zinc-400">
            {invoice.documentType} {invoice.documentNumber}
            {invoice.businessName ? ` · ${invoice.businessName}` : ""}
          </p>
          {(invoice.type === "BOLETA" || invoice.type === "FACTURA") && invoice.status === "ISSUED" && (
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <Link href={`/panel/pedidos/${orderId}/ticket`} className="text-primary hover:underline">
                Ver ticket
              </Link>
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Descargar PDF
              </a>
            </div>
          )}
        </div>

        {/* Solo tiene sentido corregir un comprobante que SUNAT ya aceptó — uno PENDING_SUNAT/FAILED
            todavía no es un documento válido que corregir. */}
        {invoice.status === "ISSUED" && (
          <CreditDebitNoteForm invoiceId={invoice.id} invoiceTotal={invoice.totalAmount} notes={invoice.notes} />
        )}
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await issueInvoice(orderId, {
        type,
        documentType,
        documentNumber,
        businessName: type === "FACTURA" ? businessName : undefined,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo emitir el comprobante");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
      <span className="text-xs uppercase tracking-wide text-zinc-500">Comprobante</span>
      <p className="mb-3 mt-1 text-sm text-zinc-400">Esta orden no tiene un comprobante emitido.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as IssueInvoiceInput["type"])} className={cn(inputClass, "text-zinc-100")}>
            <option value="BOLETA">Boleta</option>
            <option value="FACTURA">Factura</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Documento</label>
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as IssueInvoiceInput["documentType"])}
            className={cn(inputClass, "text-zinc-100")}
          >
            <option value="DNI">DNI</option>
            <option value="RUC">RUC</option>
            <option value="CE">CE</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">N° documento</label>
          <input required value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className={inputClass} />
        </div>
        {type === "FACTURA" && (
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Razón social</label>
            <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          </div>
        )}
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Emitiendo..." : "Emitir comprobante"}
        </Button>
      </form>
      {error && <span className="mt-2 block text-xs text-destructive">{error}</span>}
    </div>
  );
}
