"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-yellow-500/50";

export default function ForgotPasswordPage() {
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
      // Siempre se muestra el mismo mensaje de éxito, exista o no ese correo — ver el comentario
      // en la ruta API sobre por qué (evita que este form sirva para enumerar usuarios).
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-bold text-zinc-100">Revisa tu correo</h1>
        <p className="text-sm text-zinc-400">Si <span className="text-zinc-200">{email}</span> está registrado, te enviamos instrucciones para restablecer tu contraseña.</p>
        <Link href="/ingresar" className="mt-6 text-sm text-yellow-400 hover:underline">
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <span className="mb-1 text-xs uppercase tracking-widest text-yellow-400/80">Panel de gestión</span>
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">¿Olvidaste tu contraseña?</h1>
      <p className="mb-6 text-sm text-zinc-400">Te mandamos un enlace para crear una nueva.</p>
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
      <Link href="/ingresar" className="mt-4 text-sm text-zinc-500 hover:text-zinc-300">
        Volver a ingresar
      </Link>
    </div>
  );
}
