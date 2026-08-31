"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSunatConfig, deleteSunatConfig } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // FileReader.readAsDataURL antepone "data:application/x-pkcs12;base64," — solo interesa lo
      // que viene después de la primera coma.
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface SunatConfigStatus {
  configured: boolean;
  environment: "BETA" | "PRODUCCION";
  solUser: string | null;
  greConfigured: boolean;
}

// Integración directa con SUNAT (sin PSE/OSE) — ver domain/invoicing/sunat/. El certificado y las
// contraseñas nunca vuelven del servidor una vez guardados (GET /api/settings/sunat solo confirma
// que "hay algo configurado"), así que este form siempre empieza en blanco, incluso para
// reemplazar credenciales ya existentes.
export function SunatCredentialsForm({ initial }: { initial: SunatConfigStatus }) {
  const router = useRouter();
  const [environment, setEnvironment] = useState<"BETA" | "PRODUCCION">(initial.environment);
  const [solUser, setSolUser] = useState("");
  const [solPassword, setSolPassword] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [greClientId, setGreClientId] = useState("");
  const [greClientSecret, setGreClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!certificateFile) {
      setError("Selecciona el archivo .pfx/.p12 del certificado digital");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const certificateBase64 = await fileToBase64(certificateFile);
      await saveSunatConfig({
        environment,
        solUser,
        solPassword,
        certificateBase64,
        certificatePassword,
        greClientId: greClientId || undefined,
        greClientSecret: greClientSecret || undefined,
      });
      setSaved(true);
      setSolPassword("");
      setCertificatePassword("");
      setCertificateFile(null);
      setGreClientSecret("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("¿Quitar las credenciales SUNAT? La facturación electrónica volverá a estar simulada hasta que configures otras.")) return;
    setSaving(true);
    try {
      await deleteSunatConfig();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la configuración");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-primary/80">Facturación SUNAT (directa)</h2>
        {initial.configured ? (
          <Badge variant={initial.environment === "PRODUCCION" ? "destructive" : "outline"}>
            {initial.environment === "PRODUCCION" ? "Producción" : "Beta / homologación"}
          </Badge>
        ) : (
          <Badge variant="secondary">Sin configurar</Badge>
        )}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Integración directa (sin PSE/OSE de pago) — necesitas tu propio certificado digital (.pfx/.p12) y un usuario
        secundario SOL con permiso de "Envío de información de comprobantes de pago". Empieza siempre en{" "}
        <strong className="text-muted-foreground">Beta</strong> y valida ahí antes de pasar a Producción.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Ambiente</label>
          <select value={environment} onChange={(e) => setEnvironment(e.target.value as "BETA" | "PRODUCCION")} className={cn(inputClass, "w-full")}>
            <option value="BETA">Beta / homologación</option>
            <option value="PRODUCCION">Producción</option>
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Usuario SOL (secundario)
            <input required value={solUser} onChange={(e) => setSolUser(e.target.value)} className={inputClass} placeholder={initial.solUser ?? "MODDATOS"} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Clave SOL
            <input required type="password" value={solPassword} onChange={(e) => setSolPassword(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Certificado digital (.pfx/.p12)
            <input
              required
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => setCertificateFile(e.target.files?.[0] ?? null)}
              className={cn(inputClass, "py-1.5")}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Contraseña del certificado
            <input required type="password" value={certificatePassword} onChange={(e) => setCertificatePassword(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="mt-2 border-t border-border/60 pt-3">
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Guías de remisión (opcional)</label>
            {initial.greConfigured && <Badge variant="success">Configurado</Badge>}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Solo si vas a emitir guías de remisión — necesita un <strong className="text-muted-foreground">client_id</strong>/
            <strong className="text-muted-foreground">client_secret</strong> generados en un menú aparte de SOL (Empresas → API GRE). Al
            guardar esto, también hay que re-ingresar el usuario/clave SOL y volver a subir el certificado de arriba.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
              Client ID
              <input value={greClientId} onChange={(e) => setGreClientId(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
              Client Secret
              <input type="password" value={greClientSecret} onChange={(e) => setGreClientSecret(e.target.value)} className={inputClass} />
            </label>
          </div>
        </div>

        {error && <span className="text-sm text-destructive">{error}</span>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : initial.configured ? "Reemplazar credenciales" : "Guardar credenciales"}
          </Button>
          {initial.configured && (
            <Button type="button" variant="outline" disabled={saving} onClick={handleRemove}>
              Quitar credenciales
            </Button>
          )}
          {saved && <span className="text-sm text-emerald-400">Guardado.</span>}
        </div>
      </form>
    </div>
  );
}
