"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-yellow-500/50";

function AdminResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo restablecer la contraseña");
      router.push("/ingresar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="mb-2 text-xl font-bold text-zinc-100">Enlace inválido</h1>
        <Link href="/olvide-password" className="mt-4 inline-block text-sm text-yellow-400 hover:underline">
          Solicitar uno nuevo
        </Link>
      </div>
    );
  }

  return (
    <>
      <span className="mb-1 text-xs uppercase tracking-widest text-yellow-400/80">Plataforma SaaS</span>
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Nueva contraseña</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          type="password"
          minLength={8}
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <input
          required
          type="password"
          minLength={8}
          placeholder="Confirmar contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
        {error && <span className="text-sm text-destructive">{error}</span>}
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Restablecer contraseña"}
        </Button>
      </form>
    </>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Suspense fallback={null}>
        <AdminResetPasswordForm />
      </Suspense>
    </div>
  );
}
