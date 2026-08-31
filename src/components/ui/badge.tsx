import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "success" | "destructive" | "outline";

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "bg-primary/10 text-primary border-primary/30",
  secondary: "bg-accent text-foreground border-border",
  success: "bg-emerald-400/10 text-emerald-400 border-emerald-500/30",
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
