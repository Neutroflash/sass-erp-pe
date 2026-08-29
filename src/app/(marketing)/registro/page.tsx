"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tusaas.pe";

const inputClass =
  "h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-yellow-500/50";

export default function RegistroPage() {
  const [slug, setSlug] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredSlug, setRegisteredSlug] = useState<string | null>(null);

  const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: normalizedSlug, businessName, ownerName, email, password }),
      });
      const data = (await res.json()) as { tenant?: { slug: string }; error?: string };
      if (!res.ok || !data.tenant) throw new Error(data.error ?? "No se pudo registrar el negocio");
      setRegisteredSlug(data.tenant.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el negocio");
    } finally {
      setSubmitting(false);
    }
  }

  if (registeredSlug) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 text-center">
        <h1 className="mb-2 text-2xl font-bold text-zinc-100">¡Listo!</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Tu negocio quedó registrado en <span className="text-yellow-400">{registeredSlug}.{ROOT_DOMAIN}</span>.
        </p>
        <a href={`https://${registeredSlug}.${ROOT_DOMAIN}/ingresar`} className="inline-block">
          <Button>Ir a tu panel</Button>
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <span className="mb-1 text-xs uppercase tracking-widest text-yellow-400/80">Nuevo negocio</span>
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">Crea tu tienda</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
          Subdominio
          <div className="flex items-center gap-2">
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="mi-negocio"
              className={cn(inputClass, "flex-1")}
            />
            <span className="whitespace-nowrap text-sm text-zinc-500">.{ROOT_DOMAIN}</span>
          </div>
          {normalizedSlug && <span className="text-xs text-zinc-500">{normalizedSlug}.{ROOT_DOMAIN}</span>}
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
          Nombre del negocio
          <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
          Tu nombre
          <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
          Correo electrónico
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
          Contraseña
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && <span className="text-sm text-destructive">{error}</span>}

        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? "Creando..." : "Crear mi tienda"}
        </Button>
      </form>
    </div>
  );
}
