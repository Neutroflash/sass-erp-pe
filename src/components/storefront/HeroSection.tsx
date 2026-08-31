"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

interface Props {
  businessName: string;
  coverImageUrl: string | null;
}

export function HeroSection({ businessName, coverImageUrl }: Props) {
  return (
    <section
      className={cn(
        "relative isolate flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-white/10 py-20 text-center sm:py-28",
        // Sin cover configurado: wash púrpura/magenta fijo (independiente de --primary) para dar
        // la misma profundidad "premium" que pide el spec — el glow de --primary sigue siendo el
        // acento de marca del tenant, esto es solo textura de fondo.
        !coverImageUrl && "bg-gradient-to-br from-purple-900/20 via-neutral-900 to-black",
      )}
    >
      {coverImageUrl && (
        <>
          <Image src={coverImageUrl} alt="" fill unoptimized priority className="-z-20 object-cover" />
          {/* Overlay oscuro para que el texto siga siendo legible sobre cualquier foto que suba el
              negocio, sin importar qué tan clara sea. */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/70 to-black/40" />
        </>
      )}

      {/* Glow atado a --primary, siempre visible como acento de marca del tenant — encima del
          wash/imagen de fondo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/20 blur-[120px]"
      />

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col items-center gap-6 px-4">
        <motion.span
          variants={item}
          className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1 text-xs font-medium uppercase tracking-widest text-primary"
        >
          Tienda en línea
        </motion.span>

        <motion.h1 variants={item} className="max-w-3xl text-4xl font-black uppercase tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl">
          Bienvenido a {businessName}
        </motion.h1>

        <motion.p variants={item} className="max-w-xl text-balance text-neutral-400 sm:text-lg">
          Explora el catálogo y realiza tu pedido en minutos.
        </motion.p>

        <motion.div variants={item}>
          <Link
            href="/catalogo"
            className="btn-shimmer group relative inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Ver catálogo
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
