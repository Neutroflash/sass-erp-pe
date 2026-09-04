"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantFeatures } from "@/domain/tenant-features";
import { updateTenantSettings } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { defaultTermsAndConditions, defaultPrivacyPolicy } from "@/domain/legal/templates";

const textareaClass =
  "rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50 resize-y";

const inputClass =
  "h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

const FEATURE_LABELS: Record<keyof TenantFeatures, { label: string; hint: string }> = {
  inventoryManagement: { label: "Inventario", hint: "CRUD de productos/variantes/categorías + kardex." },
  profitMargins: { label: "Márgenes de ganancia", hint: "Ver costo y margen calculado en el panel." },
  orderValidation: { label: "Validación de pedidos", hint: "Confirmar/rechazar pagos manuales (Yape/Plin)." },
  posWeb: { label: "Punto de venta", hint: "Venta presencial desde /panel/pos." },
  sunatInvoicing: { label: "Facturación SUNAT", hint: "Emitir boletas/facturas. Necesita un proveedor (PSE) real conectado — ver docs/ROADMAP.md." },
  autoSendInvoiceEmail: { label: "Envío automático del comprobante", hint: "Mandar el PDF de la boleta/factura al correo del cliente apenas SUNAT la acepta." },
  publicStorefront: {
    label: "Tienda pública",
    hint: "Catálogo, producto y checkout en línea. Desactívalo si solo vendes por POS/mostrador/WhatsApp — el resto del panel sigue funcionando igual.",
  },
  creditSales: {
    label: "Ventas a crédito",
    hint: "Permite entregar mercadería y cobrarla después: clientes, saldos y cuentas por cobrar. El comprobante se emite al entregar, así que el IGV se declara antes de haber cobrado.",
  },
};

export interface TenantSettingsData {
  businessName: string;
  ruc: string | null;
  fiscalAddress: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  whatsappNumber: string | null;
  primaryColor: string | null;
  termsAndConditions: string | null;
  privacyPolicy: string | null;
  lowStockThreshold: number | null;
  features: TenantFeatures;
}

export function SettingsForm({ initial }: { initial: TenantSettingsData }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [ruc, setRuc] = useState(initial.ruc ?? "");
  const [fiscalAddress, setFiscalAddress] = useState(initial.fiscalAddress ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial.coverImageUrl ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor ?? "#eab308");
  const [termsAndConditions, setTermsAndConditions] = useState(initial.termsAndConditions ?? "");
  const [privacyPolicy, setPrivacyPolicy] = useState(initial.privacyPolicy ?? "");
  const [lowStockEnabled, setLowStockEnabled] = useState(initial.lowStockThreshold !== null);
  const [lowStockThreshold, setLowStockThreshold] = useState(String(initial.lowStockThreshold ?? 5));
  const [features, setFeatures] = useState<TenantFeatures>(initial.features);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateTenantSettings({
        businessName,
        ruc,
        fiscalAddress,
        logoUrl,
        coverImageUrl,
        whatsappNumber,
        primaryColor,
        termsAndConditions,
        privacyPolicy,
        lowStockThreshold: lowStockEnabled ? Number(lowStockThreshold) : null,
        features,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Datos del negocio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Razón social / nombre comercial
            <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            RUC
            <input
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              placeholder="11 dígitos"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90 sm:col-span-2">
            Dirección fiscal
            <input value={fiscalAddress} onChange={(e) => setFiscalAddress(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90 sm:col-span-2">
            URL del logo
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90 sm:col-span-2">
            URL de imagen de portada (Hero de la tienda)
            <input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            WhatsApp de contacto
            <input
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="51987654321"
              className={inputClass}
            />
            <span className="text-xs text-muted-foreground">Con código de país, sin "+" ni espacios. Habilita el botón flotante y el contacto del pie de página.</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Color primario
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#eab308"}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-input"
              />
              <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className={cn(inputClass, "flex-1")} />
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary/80">Aviso de stock bajo</h2>
        <p className="mb-4 text-xs text-muted-foreground">Un correo diario con las variantes cuyo stock disponible cae al umbral o por debajo.</p>
        <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-accent">
          <input
            type="checkbox"
            checked={lowStockEnabled}
            onChange={(e) => setLowStockEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium text-foreground">Activar aviso de stock bajo</span>
        </label>
        {lowStockEnabled && (
          <label className="flex max-w-[200px] flex-col gap-1.5 text-sm text-foreground/90">
            Umbral (unidades disponibles)
            <input
              type="number"
              min={0}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary/80">Módulos activos</h2>
        <p className="mb-4 text-xs text-muted-foreground">Desactivar un módulo lo oculta del menú y bloquea sus rutas para todo el equipo.</p>
        <div className="flex flex-col gap-3">
          {(Object.keys(FEATURE_LABELS) as (keyof TenantFeatures)[]).map((key) => (
            <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-accent">
              <input
                type="checkbox"
                checked={features[key]}
                onChange={(e) => setFeatures((f) => ({ ...f, [key]: e.target.checked }))}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">{FEATURE_LABELS[key].label}</span>
                <span className="block text-xs text-muted-foreground">{FEATURE_LABELS[key].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary/80">Legal</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Si dejas esto vacío, tu tienda muestra una plantilla genérica con tu razón social/RUC — te recomendamos
          revisarla o reemplazarla con tu propio abogado antes de operar con clientes reales.
        </p>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Términos y Condiciones
            <textarea
              rows={6}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder={defaultTermsAndConditions({ businessName: businessName || "Tu negocio", ruc: ruc || null, fiscalAddress: fiscalAddress || null })}
              className={textareaClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Política de Privacidad
            <textarea
              rows={6}
              value={privacyPolicy}
              onChange={(e) => setPrivacyPolicy(e.target.value)}
              placeholder={defaultPrivacyPolicy({ businessName: businessName || "Tu negocio", ruc: ruc || null, fiscalAddress: fiscalAddress || null })}
              className={textareaClass}
            />
          </label>
        </div>
      </div>

      {error && <span className="text-sm text-destructive">{error}</span>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
        {saved && <span className="text-sm text-emerald-400">Guardado.</span>}
      </div>
    </form>
  );
}
