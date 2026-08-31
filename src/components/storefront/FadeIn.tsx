"use client";

import { motion } from "framer-motion";

interface Props {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

// Wrapper genérico de entrada (fade + slide-up) para secciones sueltas fuera de un grid animado
// (Hero y CatalogGrid ya tienen su propio stagger) — usado en la página de producto.
export function FadeIn({ children, delay = 0, className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
