"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

// Fuera de /panel a propósito — ver el comentario en panel/layout.tsx sobre por qué esta página
// no puede vivir dentro del árbol que ese layout protege.
export default function TenantLoginPage() {
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
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar sesión");
      router.push("/panel");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <span className="mb-1 text-xs uppercase tracking-widest text-primary/80">Panel de gestión</span>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Ingresar</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
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
      <Link href="/olvide-password" className="mt-4 text-sm text-muted-foreground hover:text-foreground/90">
        ¿Olvidaste tu contraseña?
      </Link>
    </div>
  );
}
