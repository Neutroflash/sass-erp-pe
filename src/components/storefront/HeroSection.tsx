"use client";

import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

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
}

export function HeroSection({ businessName }: Props) {
  return (
    <section className="relative flex flex-col items-center gap-6 overflow-hidden py-16 text-center sm:py-20">
      {/* Glow atado a --primary (el color del tenant) — no dorado fijo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
      />

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col items-center gap-6">
        <motion.span
          variants={item}
          className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1 text-xs font-medium uppercase tracking-widest text-primary"
        >
          Tienda en línea
        </motion.span>

        <motion.h1 variants={item} className="max-w-3xl text-4xl font-black tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl">
          {businessName}
        </motion.h1>

        <motion.p variants={item} className="max-w-xl text-balance text-zinc-400 sm:text-lg">
          Bienvenido a nuestra tienda en línea. Explora el catálogo y realiza tu pedido en minutos.
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
