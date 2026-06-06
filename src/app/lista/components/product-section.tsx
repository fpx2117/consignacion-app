"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import type { PublicCatalogConfig, PublicCatalogProduct, CatalogCartItem } from "@/lib/types";
import { ProductCard } from "./product-card";

type ProductSectionProps = {
  title: string;
  count: number;
  products: PublicCatalogProduct[];
  config: PublicCatalogConfig;
  viewMode: "grid" | "list";
  isConsigne: boolean;
  onAddToCart: (product: PublicCatalogProduct, quantity?: number) => void;
  onViewProduct: (product: PublicCatalogProduct) => void;
  onViewAll?: () => void;
  compact?: boolean;
  className?: string;
  forceGrid?: boolean;
  /** Carrito actual para mostrar cantidades en las cards */
  cart?: CatalogCartItem[];
  /** Actualizar cantidad directamente (stepper) */
  onUpdateCartQuantity?: (productId: number, newQty: number) => void;
};

export function ProductSection({
  title,
  count,
  products,
  config,
  viewMode,
  isConsigne,
  onAddToCart,
  onViewProduct,
  onViewAll,
  compact = false,
  className = "",
  forceGrid = false,
  cart = [],
  onUpdateCartQuantity,
}: ProductSectionProps) {
  const ols = config.onlineStoreConfig;
  const productLayout = ols?.catalog?.productLayout ?? "grid";
  const showViewAll = ols?.catalog?.showViewAll ?? true;

  // Mapa rápido: productId → cantidad en carrito
  const cartMap = React.useMemo(() => {
    const m = new Map<number, number>();
    for (const item of cart) {
      m.set(item.id, item.quantity);
    }
    return m;
  }, [cart]);

  const getLayoutClass = () => {
    if (productLayout === "compact" || viewMode === "list") {
      return "flex flex-col gap-3";
    }
    if (productLayout === "horizontal" && !forceGrid) {
      return "flex lg:grid lg:grid-cols-3 xl:grid-cols-4 overflow-x-auto lg:overflow-visible gap-3 snap-x snap-mandatory lg:snap-none pb-2 lg:pb-0";
    }
    return "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4";
  };

  const getCardWidthClass = () => {
    if (productLayout === "horizontal" && !forceGrid) {
      return "min-w-[160px] max-w-[180px] snap-start lg:min-w-0 lg:max-w-none";
    }
    return "";
  };

  if (!products.length) return null;

  const isListView = productLayout === "compact" || viewMode === "list";

  return (
    <section className={className}>
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-bold text-[var(--store-text,#0F172A)]">{title}</h3>
          <span className="text-sm text-[var(--store-muted,#8A8F98)]">{count}</span>
        </div>
        {showViewAll && onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-0.5 text-sm font-medium text-[var(--store-primary,#007AFF)] hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            Ver todo
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={`px-4 ${getLayoutClass()}`}>
        {products.map((product, index) => (
          <div key={product.id} className={getCardWidthClass()}>
            <ProductCard
              product={product}
              config={config}
              isConsigne={isConsigne}
              viewMode={isListView ? "list" : "grid"}
              onAddToCart={onAddToCart}
              onViewProduct={onViewProduct}
              index={index}
              compact={compact}
              cartQuantity={cartMap.get(product.id) ?? 0}
              onUpdateCartQuantity={onUpdateCartQuantity}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
