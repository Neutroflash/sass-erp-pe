"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// No bloqueante a propósito — ver el comentario en User.emailVerifiedAt (schema.prisma) sobre por
// qué. Solo un aviso persistente hasta que se verifique.
export function EmailVerificationBanner({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "No se pudo reenviar");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
      <span className="text-yellow-200">
        Todavía no confirmaste <span className="font-medium">{email}</span>.
        {sent && <span className="ml-2 text-emerald-400">Te reenviamos el enlace.</span>}
        {error && <span className="ml-2 text-destructive">{error}</span>}
      </span>
      <Button size="sm" variant="outline" disabled={sending || sent} onClick={handleResend}>
        {sending ? "Enviando..." : sent ? "Enviado" : "Reenviar verificación"}
      </Button>
    </div>
  );
}
