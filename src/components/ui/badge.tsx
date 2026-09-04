import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-primary/30",
  secondary: "bg-accent text-foreground border-border",
  success: "bg-emerald-400/10 text-emerald-400 border-emerald-500/30",
  // Estado que pide atención sin ser un error — una deuda por cobrar no es un fallo, pero
  // tampoco puede leerse en verde junto a las ventas ya cobradas.
  warning: "bg-amber-400/10 text-amber-500 border-amber-500/30",
  destructive: "bg-red-400/10 text-red-400 border-red-500/30",
  outline: "bg-transparent text-muted-foreground border-border",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
