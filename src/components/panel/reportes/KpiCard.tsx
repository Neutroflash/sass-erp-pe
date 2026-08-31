import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  sublabel?: string;
  /** % de cambio vs. el período anterior — undefined = no aplica a esta métrica, null = no hay
   *  base de comparación real (período anterior en cero) para no mostrar un delta engañoso. */
  trend?: number | null;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, sublabel, trend, icon }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {(trend !== undefined || sublabel) && (
        <div className="flex items-center gap-2">
          {trend !== undefined && trend !== null && (
            <span className={cn("flex items-center gap-0.5 text-xs font-semibold", trend >= 0 ? "text-emerald-400" : "text-destructive")}>
              {trend >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
