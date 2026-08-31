"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-yellow-500/50";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-bold text-foreground">Revisa tu correo</h1>
        <p className="text-sm text-muted-foreground">Si <span className="text-foreground">{email}</span> está registrado, te enviamos instrucciones para restablecer tu contraseña.</p>
        <Link href="/ingresar" className="mt-6 text-sm text-yellow-400 hover:underline">
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <span className="mb-1 text-xs uppercase tracking-widest text-yellow-400/80">Plataforma SaaS</span>
      <h1 className="mb-2 text-2xl font-bold text-foreground">¿Olvidaste tu contraseña?</h1>
      <p className="mb-6 text-sm text-muted-foreground">Te mandamos un enlace para crear una nueva.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar enlace"}
        </Button>
      </form>
      <Link href="/ingresar" className="mt-4 text-sm text-muted-foreground hover:text-foreground/90">
        Volver a ingresar
      </Link>
    </div>
  );
}
