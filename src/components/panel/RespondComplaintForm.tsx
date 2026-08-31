"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputClass =
  "rounded-lg border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors focus:border-primary";

export function RespondComplaintForm({ complaintId }: { complaintId: string }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la respuesta");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la respuesta");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        required
        rows={4}
        placeholder="Escribe tu respuesta al consumidor..."
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        className={`${inputClass} resize-none`}
      />
      {error && <span className="text-sm text-destructive">{error}</span>}
      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Guardando..." : "Guardar respuesta y marcar como resuelto"}
      </Button>
    </form>
  );
}
