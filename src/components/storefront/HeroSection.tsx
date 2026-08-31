"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { ArrowRight, ShoppingBag } from "lucide-react";

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

// Layout partido: la copy vive sobre el fondo normal de la página (bg-card/40, reactivo al tema),
// nunca sobre una imagen — así el texto puede volver a usar tokens de tema en vez de colores fijos.
// El panel oscuro de la derecha es el único elemento "siempre oscuro a propósito": o muestra la
// foto de portada del tenant, o —si no configuró una— un panel abstracto de vitrina/promo.
export function HeroSection({ businessName, coverImageUrl }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card/40">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 -z-10 h-[420px] w-[420px] rounded-full bg-primary/20 blur-[120px]"
      />

      <div className="relative grid gap-10 px-6 py-14 sm:px-10 sm:py-16 lg:grid-cols-2 lg:items-center lg:py-20">
        <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col items-start gap-6 text-left">
          <motion.span
            variants={item}
            className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1 text-xs font-medium uppercase tracking-widest text-primary"
          >
            Tienda en línea
          </motion.span>

          <motion.h1 variants={item} className="max-w-xl text-4xl font-black uppercase tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Bienvenido a {businessName}
          </motion.h1>

          <motion.p variants={item} className="max-w-md text-balance text-muted-foreground sm:text-lg">
            Explora el catálogo y realiza tu pedido en minutos.
          </motion.p>

          <motion.div variants={item}>
            <Link
              href="/catalogo"
              className="btn-shimmer group relative inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Explorar catálogo
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          className="relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border lg:aspect-square"
        >
          {coverImageUrl ? (
            <>
              <Image src={coverImageUrl} alt="" fill unoptimized priority className="object-cover" />
              {/* Solo profundidad, ningún texto se apoya sobre esta foto — no necesita ser fija. */}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </>
          ) : (
            // Sin cover configurado: panel abstracto fijo (independiente del tema), misma
            // profundidad "premium" que pedía el spec original — nunca lleva texto de tema encima.
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black bg-grid-pattern">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <ShoppingBag className="h-7 w-7 text-primary" />
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
                Catálogo actualizado
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
