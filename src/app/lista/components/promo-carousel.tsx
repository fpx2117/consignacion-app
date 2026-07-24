"use client";

import * as React from "react";
import { motion } from "motion/react";
import type { OnlineStorePromoItem } from "@/lib/types";

type PromoCarouselProps = {
  items: OnlineStorePromoItem[];
  className?: string;
};

/**
 * Carrusel horizontal de cards de promociones visuales.
 * Solo se muestra si hay items visibles.
 */
export function PromoCarousel({ items, className = "" }: PromoCarouselProps) {
  const visibleItems = items
    .filter((item) => item.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (visibleItems.length === 0) return null;

  return (
    <div className={`${className}`}>
      <div
        className="flex overflow-x-auto gap-3 px-4 pb-1 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none" }}
      >
        {visibleItems.map((promo, i) => (
          <motion.div
            key={promo.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex-shrink-0 w-[240px] sm:w-[280px] snap-start rounded-2xl p-4 flex items-center gap-3 shadow-sm"
            style={{
              backgroundColor:
                promo.backgroundColor || "var(--store-surface,#FFFFFF)",
              color: promo.textColor || "var(--store-text,#0F172A)",
            }}
          >
            {/* Ícono grande */}
            <span
              className="text-3xl flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl"
              style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
            >
              {promo.icon}
            </span>

            {/* Texto */}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm leading-tight truncate">
                {promo.title}
              </p>
              {promo.description && (
                <p className="text-xs mt-0.5 opacity-75 leading-snug line-clamp-2">
                  {promo.description}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
