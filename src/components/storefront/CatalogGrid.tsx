"use client";

import { motion, Variants } from "framer-motion";
import type { PublicProduct } from "@/domain/inventory/product";
import { ProductCard } from "./ProductCard";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function CatalogGrid({ products }: { products: PublicProduct[] }) {
  if (products.length === 0) {
    return <p className="py-16 text-center text-zinc-500">No se encontraron productos.</p>;
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {products.map((product) => (
        <motion.div key={product.id} variants={item}>
          <ProductCard product={product} />
        </motion.div>
      ))}
    </motion.div>
  );
}
