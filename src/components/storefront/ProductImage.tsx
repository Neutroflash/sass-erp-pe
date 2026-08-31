"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

// Reemplaza el "Sin imagen" de texto plano que tenían ProductCard/ProductGallery por un estado
// elegante (ícono + fondo sutil) cuando la URL es null, y agrega un skeleton mientras la imagen
// real está cargando — antes esa transición era un salto brusco de vacío a imagen. Requiere un
// padre `relative` (usa `fill`), igual que el <Image> que reemplaza.
export function ProductImage({ src, alt, sizes, priority, className }: Props) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-accent text-muted-foreground/50">
        <ImageOff className="h-8 w-8" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <>
      {!loaded && <div aria-hidden className="absolute inset-0 animate-pulse bg-accent" />}
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        priority={priority}
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        className={cn(className, "transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
      />
    </>
  );
}
