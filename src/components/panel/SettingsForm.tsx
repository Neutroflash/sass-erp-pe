"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantFeatures } from "@/domain/tenant-features";
import { updateTenantSettings } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-primary/50";

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
};

export interface TenantSettingsData {
  businessName: string;
  ruc: string | null;
  fiscalAddress: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  lowStockThreshold: number | null;
  features: TenantFeatures;
}

export function SettingsForm({ initial }: { initial: TenantSettingsData }) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [ruc, setRuc] = useState(initial.ruc ?? "");
  const [fiscalAddress, setFiscalAddress] = useState(initial.fiscalAddress ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor ?? "#eab308");
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
        primaryColor,
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
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary/80">Datos del negocio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            Razón social / nombre comercial
            <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            RUC
            <input
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              placeholder="11 dígitos"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300 sm:col-span-2">
            Dirección fiscal
            <input value={fiscalAddress} onChange={(e) => setFiscalAddress(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300 sm:col-span-2">
            URL del logo
            <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-zinc-300">
            Color primario
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#eab308"}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-black/30"
              />
              <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className={cn(inputClass, "flex-1")} />
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary/80">Aviso de stock bajo</h2>
        <p className="mb-4 text-xs text-zinc-500">Un correo diario con las variantes cuyo stock disponible cae al umbral o por debajo.</p>
        <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-white/[0.03]">
          <input
            type="checkbox"
            checked={lowStockEnabled}
            onChange={(e) => setLowStockEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium text-zinc-100">Activar aviso de stock bajo</span>
        </label>
        {lowStockEnabled && (
          <label className="flex max-w-[200px] flex-col gap-1.5 text-sm text-zinc-300">
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

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-md">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary/80">Módulos activos</h2>
        <p className="mb-4 text-xs text-zinc-500">Desactivar un módulo lo oculta del menú y bloquea sus rutas para todo el equipo.</p>
        <div className="flex flex-col gap-3">
          {(Object.keys(FEATURE_LABELS) as (keyof TenantFeatures)[]).map((key) => (
            <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-white/[0.03]">
              <input
                type="checkbox"
                checked={features[key]}
                onChange={(e) => setFeatures((f) => ({ ...f, [key]: e.target.checked }))}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium text-zinc-100">{FEATURE_LABELS[key].label}</span>
                <span className="block text-xs text-zinc-500">{FEATURE_LABELS[key].hint}</span>
              </span>
            </label>
          ))}
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
