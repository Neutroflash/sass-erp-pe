"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { issueDispatchGuide } from "@/lib/panel-mutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const inputClass =
  "h-9 rounded-lg border border-border bg-input px-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

export interface OrderDispatchGuideSummary {
  id: string;
  series: string;
  number: number;
  status: "PENDING_SUNAT" | "ISSUED" | "FAILED";
}

const STATUS_LABEL: Record<OrderDispatchGuideSummary["status"], string> = {
  PENDING_SUNAT: "Enviada, esperando respuesta de SUNAT",
  ISSUED: "Aceptada",
  FAILED: "Rechazada",
};

// v1: solo "transporte privado" (el propio negocio traslada, sin transportista contratado) y
// motivo "venta" — ver domain/dispatch-guides/xml-builder.ts. No verificado en vivo contra SUNAT
// (la API GRE no tiene cuenta pública de pruebas) — ver docs/LANZAMIENTO.md.
export function DispatchGuideSection({ orderId, dispatchGuide }: { orderId: string; dispatchGuide: OrderDispatchGuideSummary | null }) {
  const router = useRouter();
  const [docType, setDocType] = useState("1");
  const [docNumber, setDocNumber] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [weightKg, setWeightKg] = useState("");
  const [originUbigeo, setOriginUbigeo] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [destinationUbigeo, setDestinationUbigeo] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [plate, setPlate] = useState("");
  const [driverDoc, setDriverDoc] = useState("");
  const [driverFirstName, setDriverFirstName] = useState("");
  const [driverLastName, setDriverLastName] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dispatchGuide) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Guía de remisión</span>
        <p className="mt-1 text-foreground">
          {dispatchGuide.series}-{dispatchGuide.number}
        </p>
        <Badge
          className="mt-2"
          variant={dispatchGuide.status === "ISSUED" ? "success" : dispatchGuide.status === "FAILED" ? "destructive" : "outline"}
        >
          {STATUS_LABEL[dispatchGuide.status]}
        </Badge>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await issueDispatchGuide(orderId, {
        destinatario: { documentTypeCode: docType, documentNumber: docNumber, name: recipientName },
        fechaTraslado: transferDate,
        pesoTotalKg: Number(weightKg),
        origen: { ubigeo: originUbigeo, address: originAddress },
        destino: { ubigeo: destinationUbigeo, address: destinationAddress },
        vehiculoPlaca: plate,
        chofer: { documentNumber: driverDoc, firstName: driverFirstName, lastName: driverLastName, license: driverLicense },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo emitir la guía");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary/80">Guía de remisión (transporte privado)</h3>
      <p className="mb-4 text-xs text-muted-foreground">Motivo: venta. El vehículo y el conductor son los propios del negocio, sin transportista contratado.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Tipo doc. destinatario
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={inputClass}>
              <option value="1">DNI</option>
              <option value="6">RUC</option>
              <option value="4">CE</option>
              <option value="7">Pasaporte</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            N° documento
            <input required value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Nombre / razón social
            <input required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Fecha de traslado
            <input required type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Peso total (kg)
            <input required type="number" min="0.001" step="0.001" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Ubigeo origen (6 dígitos)
            <input required maxLength={6} value={originUbigeo} onChange={(e) => setOriginUbigeo(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Dirección origen
            <input required value={originAddress} onChange={(e) => setOriginAddress(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Ubigeo destino (6 dígitos)
            <input required maxLength={6} value={destinationUbigeo} onChange={(e) => setDestinationUbigeo(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Dirección destino
            <input required value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} className={inputClass} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Placa del vehículo
            <input required value={plate} onChange={(e) => setPlate(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            DNI del conductor
            <input required value={driverDoc} onChange={(e) => setDriverDoc(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Nombres del conductor
            <input required value={driverFirstName} onChange={(e) => setDriverFirstName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Apellidos del conductor
            <input required value={driverLastName} onChange={(e) => setDriverLastName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-foreground/90">
            Licencia de conducir
            <input required value={driverLicense} onChange={(e) => setDriverLicense(e.target.value)} className={inputClass} />
          </label>
        </div>

        {error && <span className="text-sm text-destructive">{error}</span>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Emitiendo..." : "Emitir guía de remisión"}
        </Button>
      </form>
    </div>
  );
}
