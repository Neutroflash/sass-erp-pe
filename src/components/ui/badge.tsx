import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "success" | "destructive" | "outline";

const VARIANT_CLASSES: Record<Variant, string> = {
  default: "bg-yellow-400/10 text-yellow-400 border-yellow-500/30",
  secondary: "bg-white/10 text-zinc-200 border-white/10",
  success: "bg-emerald-400/10 text-emerald-400 border-emerald-500/30",
  destructive: "bg-red-400/10 text-red-400 border-red-500/30",
  outline: "bg-transparent text-zinc-400 border-zinc-700",
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
