"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Status = "verifying" | "success" | "error";

function VerifyEmailInner() {
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Falta el enlace de verificación");
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "No se pudo verificar el correo");
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "No se pudo verificar el correo");
      });
  }, [token]);

  if (status === "verifying") {
    return <p className="text-sm text-muted-foreground">Verificando...</p>;
  }

  if (status === "error") {
    return (
      <>
        <h1 className="mb-2 text-xl font-bold text-foreground">No se pudo verificar</h1>
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/panel" className="mt-6 inline-block text-sm text-primary hover:underline">
          Ir al panel
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-xl font-bold text-foreground">¡Correo verificado!</h1>
      <p className="text-sm text-muted-foreground">Ya puedes usar tu cuenta con normalidad.</p>
      <Link href="/panel" className="mt-6 inline-block">
        <Button>Ir al panel</Button>
      </Link>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 text-center">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando...</p>}>
        <VerifyEmailInner />
      </Suspense>
    </div>
  );
}
