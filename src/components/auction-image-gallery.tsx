"use client";

import Image from "next/image";
import { useState } from "react";
import type { AuctionImage } from "@/lib/types";
import { AuctionImagePlaceholder } from "@/components/auction-image-branding";

type AuctionImageGalleryProps = {
  images: AuctionImage[];
  title: string;
};

export function AuctionImageGallery({ images, title }: AuctionImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = images[selectedIndex];

  if (!selectedImage) {
    return (
      <div className="card h-[360px] overflow-hidden md:h-[520px]">
        <AuctionImagePlaceholder title={title} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <div className="relative h-[360px] md:h-[520px]">
          <Image
            src={selectedImage.image_url}
            alt={selectedImage.alt_text || title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
          />
          {images.length > 1 ? (
            <div className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-extrabold text-[var(--primary)] shadow-sm">
              {selectedIndex + 1} / {images.length}
            </div>
          ) : null}
        </div>
      </div>

      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {images.map((image, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                key={`${image.image_url}-${image.position}`}
                type="button"
                aria-label={`View image ${index + 1}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedIndex(index)}
                className={`relative aspect-square overflow-hidden rounded-lg border bg-white transition ${
                  isSelected
                    ? "border-[var(--primary)] ring-2 ring-[var(--primary)]"
                    : "border-[var(--line)] hover:border-[var(--primary)]"
                }`}
              >
                <Image
                  src={image.image_url}
                  alt={image.alt_text || `${title} image ${index + 1}`}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
