"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-9 rounded-lg border border-border bg-input px-2 text-sm text-foreground outline-none transition-colors focus:border-primary/50";

const PLAN_LABELS: Record<string, string> = { FREE: "Gratis", STARTER: "Starter", PRO: "Pro" };

export function PlanSelector({ currentPlan }: { currentPlan: "FREE" | "STARTER" | "PRO" }) {
  const router = useRouter();
  const [plan, setPlan] = useState(currentPlan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: plan }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "No se pudo cambiar de plan");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar de plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)} className={cn(inputClass, "w-32")}>
        {Object.entries(PLAN_LABELS).map(([tier, label]) => (
          <option key={tier} value={tier}>
            {label}
          </option>
        ))}
      </select>
      <Button size="sm" variant="outline" disabled={saving || plan === currentPlan} onClick={handleChange}>
        {saving ? "Cambiando..." : "Cambiar de plan"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
