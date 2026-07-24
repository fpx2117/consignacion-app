"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeStorefrontContent } from "@/lib/storefront/storefront-content";
import type { PublicCatalogConfig } from "@/lib/types";

export function StoreBanner({
  config,
  productsCount,
  categoriesCount,
  onPrimaryAction,
}: {
  config: PublicCatalogConfig;
  productsCount: number;
  categoriesCount: number;
  onPrimaryAction?: () => void;
}) {
  const banners = Array.isArray(config.banners) ? config.banners : [];
  const isSliderMode = Boolean(config.isBannerSlider) && banners.length > 0;
  const staticBannerSrc =
    config.bannerUrl ||
    (config.bannerData
      ? `data:${config.bannerMime};base64,${config.bannerData}`
      : null);
  const content = normalizeStorefrontContent(config.storefrontContent, {
    storeName: config.businessName,
  });

  return (
    <section className="relative w-full overflow-hidden bg-gray-900">
      {/* Banner Image */}
      <div className="absolute inset-0">
        {isSliderMode && banners[0] ? (
          <Image
            src={
              banners[0].url ||
              `data:${banners[0].bannerMime};base64,${banners[0].bannerData}`
            }
            alt="Banner"
            fill
            unoptimized
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : staticBannerSrc ? (
          <Image
            src={staticBannerSrc}
            alt="Banner de la tienda"
            fill
            unoptimized
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : null}
        {/* Subtle overlay - much lighter than before so the image shows through */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:py-24 lg:py-32">
        <div className="max-w-xl">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
            {content.heroBadge || "Tienda online"}
          </span>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {content.heroTitle || "Nuestros Productos"}
          </h1>

          <p className="mt-4 text-base leading-relaxed text-white/80 sm:text-lg max-w-lg">
            {content.heroDescription ||
              "Descubrí productos seleccionados con la mejor calidad."}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              onClick={onPrimaryAction}
              size="lg"
              className="rounded-full px-8 font-semibold shadow-lg hover:opacity-90 text-white"
              style={{ backgroundColor: config.primaryColor || "#111827" }}
            >
              {content.heroPrimaryCtaLabel || "Ver productos"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <div className="hidden sm:flex items-center gap-6 pl-4 border-l border-white/20">
              <div className="text-white">
                <span className="text-2xl font-bold">{productsCount}</span>
                <span className="ml-1.5 text-sm text-white/70">productos</span>
              </div>
              <div className="text-white">
                <span className="text-2xl font-bold">{categoriesCount}</span>
                <span className="ml-1.5 text-sm text-white/70">categorías</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
