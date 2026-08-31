import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  /** Dónde se centra el resplandor ambiental — "left" para un layout partido (copy a la
   *  izquierda), "center" para un hero centrado clásico. */
  glow?: "left" | "center";
  className?: string;
}

// Resplandor radial del Hero, atado a --primary — la grilla de líneas ahora vive un nivel más
// arriba, en (storefront)/layout.tsx, como fondo de toda la tienda (no solo del Hero); este
// wrapper se queda solo con el glow puntual detrás del título. Usa el token --primary, así que se
// ve correcto en claro/oscuro y con el color de marca de cada tenant sin ninguna clase dark:/light:
// explícita — el mismo criterio que ya usa el resto del storefront.
export function HeroBackground({ children, glow = "left", className }: Props) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -z-10 h-[420px] w-[620px] rounded-full bg-primary/20 blur-[120px]",
          glow === "left"
            ? "-left-24 top-0 -translate-y-1/3"
            : "left-1/2 top-0 -translate-x-1/2 -translate-y-1/3",
        )}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
