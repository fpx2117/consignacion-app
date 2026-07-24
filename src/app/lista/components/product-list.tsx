"use client";

import { PackageOpen } from "lucide-react";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";
import type { PublicCatalogConfig, PublicCatalogProduct } from "@/lib/types";

interface ProductListProps {
  products: PublicCatalogProduct[];
  config: PublicCatalogConfig;
  viewMode: "grid" | "list";
  isConsigne: boolean;
  onAddToCart: (product: PublicCatalogProduct, quantity?: number) => void;
  onViewProduct: (product: PublicCatalogProduct) => void;
  compact?: boolean;
}

export function ProductList({
  products,
  config,
  viewMode,
  isConsigne,
  onAddToCart,
  onViewProduct,
  compact = false,
}: ProductListProps) {
  const isGrid = viewMode === "grid";

  if (!products || products.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center text-center opacity-40">
        <PackageOpen className="h-16 w-16 mb-4" />
        <p className="text-lg font-medium">
          No encontramos productos con esos filtros
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid animate-in fade-in duration-500",
        isGrid
          ? compact
            ? "grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            : "grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 lg:gap-6"
          : "grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5",
      )}
    >
      {products.map((product, idx) => (
        <ProductCard
          key={product.id}
          product={product}
          index={idx}
          config={config}
          viewMode={viewMode}
          isConsigne={isConsigne}
          onAddToCart={onAddToCart}
          onViewProduct={onViewProduct}
          compact={compact}
        />
      ))}
    </div>
  );
}
