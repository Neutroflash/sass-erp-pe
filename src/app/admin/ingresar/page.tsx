"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-yellow-500/50";

// Fuera de /admin/(protected) a propósito — ver el comentario en (protected)/layout.tsx.
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar sesión");
      router.push("/tenants");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <span className="mb-1 text-xs uppercase tracking-widest text-yellow-400/80">Plataforma SaaS</span>
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Ingresar</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input required type="email" placeholder="Correo electrónico" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        <input
          required
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {error && <span className="text-sm text-destructive">{error}</span>}
        <Button type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>
      <Link href="/olvide-password" className="mt-4 text-sm text-zinc-500 hover:text-zinc-300">
        ¿Olvidaste tu contraseña?
      </Link>
    </div>
  );
}
