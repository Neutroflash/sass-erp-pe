"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface GalleryImage {
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

interface Props {
  images: GalleryImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: Props) {
  const sorted = [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  const [active, setActive] = useState(sorted[0]);

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-zinc-800/80 bg-black/30 text-sm text-zinc-600">
        Sin imagen
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-800/80 bg-black/30">
        <Image src={active.url} alt={active.altText ?? productName} fill unoptimized className="object-cover" />
      </div>

      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setActive(img)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-colors",
                img.url === active.url ? "border-primary" : "border-zinc-800/80 hover:border-zinc-700",
              )}
              aria-label={`Ver imagen ${img.altText ?? productName}`}
            >
              <Image src={img.url} alt={img.altText ?? productName} fill unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
