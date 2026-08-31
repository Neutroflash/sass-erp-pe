"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "rounded-lg border border-border bg-input px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary";
const labelClass = "flex flex-col gap-1.5 text-sm text-foreground/90";

const initialForm = {
  type: "RECLAMO" as "RECLAMO" | "QUEJA",
  consumerName: "",
  consumerDocType: "DNI" as "DNI" | "CE" | "PASAPORTE",
  consumerDocNumber: "",
  consumerAddress: "",
  consumerPhone: "",
  consumerEmail: "",
  productDescription: "",
  claimedAmount: "",
  purchaseDate: "",
  detail: "",
  request: "",
};

export function ComplaintForm({ businessName }: { businessName: string }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folio, setFolio] = useState<number | null>(null);

  function set<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          claimedAmount: form.claimedAmount ? Number(form.claimedAmount) : undefined,
          purchaseDate: form.purchaseDate || undefined,
        }),
      });
      const data = (await res.json()) as { folio?: number; error?: string };
      if (!res.ok || data.folio === undefined) throw new Error(data.error ?? "No se pudo registrar tu reclamo");
      setFolio(data.folio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar tu reclamo");
    } finally {
      setSubmitting(false);
    }
  }

  if (folio !== null) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-6 text-center">
        <h2 className="mb-2 text-xl font-bold text-foreground">Reclamo registrado</h2>
        <p className="mb-1 text-muted-foreground">
          Tu {form.type === "RECLAMO" ? "reclamo" : "queja"} quedó registrado con el folio{" "}
          <span className="font-bold text-primary">N° {folio}</span>.
        </p>
        <p className="text-sm text-muted-foreground">Te enviamos una constancia a {form.consumerEmail}. Guárdala como comprobante.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Tipo</h2>
        <div className="flex gap-4">
          {(["RECLAMO", "QUEJA"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm text-foreground/90">
              <input type="radio" name="type" checked={form.type === t} onChange={() => set("type", t)} className="accent-primary" />
              {t === "RECLAMO" ? "Reclamo (disconformidad con el producto)" : "Queja (disconformidad con la atención)"}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Tus datos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={cn(labelClass, "sm:col-span-2")}>
            Nombre completo
            <input required value={form.consumerName} onChange={(e) => set("consumerName", e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Tipo de documento
            <select
              value={form.consumerDocType}
              onChange={(e) => set("consumerDocType", e.target.value as typeof form.consumerDocType)}
              className={inputClass}
            >
              <option value="DNI">DNI</option>
              <option value="CE">Carné de extranjería</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </label>
          <label className={labelClass}>
            N° de documento
            <input
              required
              value={form.consumerDocNumber}
              onChange={(e) => set("consumerDocNumber", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={cn(labelClass, "sm:col-span-2")}>
            Dirección
            <input required value={form.consumerAddress} onChange={(e) => set("consumerAddress", e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Teléfono (opcional)
            <input value={form.consumerPhone} onChange={(e) => set("consumerPhone", e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Correo electrónico
            <input
              required
              type="email"
              value={form.consumerEmail}
              onChange={(e) => set("consumerEmail", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Bien contratado</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={cn(labelClass, "sm:col-span-2")}>
            Descripción del producto/servicio
            <input
              required
              value={form.productDescription}
              onChange={(e) => set("productDescription", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Monto reclamado (S/, opcional)
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.claimedAmount}
              onChange={(e) => set("claimedAmount", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Fecha de compra (opcional)
            <input type="date" value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} className={inputClass} />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Detalle</h2>
        <div className="flex flex-col gap-4">
          <label className={labelClass}>
            Detalle de tu {form.type === "RECLAMO" ? "reclamo" : "queja"}
            <textarea
              required
              rows={4}
              value={form.detail}
              onChange={(e) => set("detail", e.target.value)}
              className={cn(inputClass, "resize-none")}
            />
          </label>
          <label className={labelClass}>
            Pedido concreto (qué solicitas a {businessName})
            <textarea
              required
              rows={2}
              value={form.request}
              onChange={(e) => set("request", e.target.value)}
              className={cn(inputClass, "resize-none")}
            />
          </label>
        </div>
      </div>

      {error && <span className="text-sm text-destructive">{error}</span>}
      <Button type="submit" disabled={submitting} size="md">
        {submitting ? "Enviando..." : "Enviar reclamo"}
      </Button>
    </form>
  );
}
