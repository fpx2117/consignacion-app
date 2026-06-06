"use client";

import * as React from "react";
import { motion } from "motion/react";
import type { PublicCatalogCategory, PublicCatalogProduct } from "@/lib/types";

type CategoryTabsProps = {
  categories: PublicCatalogCategory[];
  selectedCategory: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  className?: string;
  /** Productos para filtrar categorías con stock */
  allProducts?: PublicCatalogProduct[];
};

/**
 * Tabs horizontales de categorías con scroll.
 * Solo muestra categorías que tengan productos.
 * Categoría activa en negrita con línea animada debajo.
 */
export function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
  className = "",
  allProducts,
}: CategoryTabsProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const activeRef = React.useRef<HTMLButtonElement>(null);

  // Conteo de productos por categoría
  const categoryCounts = React.useMemo(() => {
    if (!allProducts) return {} as Record<number, number>;
    return allProducts.reduce<Record<number, number>>((acc, p) => {
      if (p.categoriaId !== null) {
        acc[p.categoriaId] = (acc[p.categoriaId] || 0) + 1;
      }
      return acc;
    }, {});
  }, [allProducts]);

  // Auto-scroll al tab activo
  React.useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scrollLeft = el.offsetLeft - container.offsetLeft - containerRect.width / 2 + elRect.width / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [selectedCategory]);

  // Solo categorías con productos
  const filteredCategories = React.useMemo(() => {
    if (!allProducts) return categories; // sin datos, mostrar todas
    return categories.filter((c) => (categoryCounts[c.id] || 0) > 0);
  }, [categories, categoryCounts, allProducts]);

  if (!categories || categories.length === 0) return null;

  const allTabs = [
    { id: null as null, nombre: "Todas" },
    ...filteredCategories.map((c) => ({ id: c.id as number | null, nombre: c.nombre })),
  ];

  return (
    <div className={`bg-[var(--store-surface,#FFFFFF)] ${className}`}>
      <div
        ref={scrollRef}
        className="flex overflow-x-auto px-3 gap-1 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {allTabs.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id ?? "all"}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelectCategory(cat.id)}
              className={`
                relative flex-shrink-0 px-4 py-3.5 text-sm whitespace-nowrap
                transition-colors duration-200 font-medium
                ${isActive
                  ? "text-[var(--store-text,#0F172A)] font-bold"
                  : "text-[var(--store-muted,#8A8F98)] hover:text-[var(--store-text,#0F172A)]"
                }
              `}
            >
              {cat.nombre}
              {isActive && (
                <motion.span
                  layoutId="category-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: "var(--store-primary,#007AFF)" }}
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="h-px bg-gray-100" />
    </div>
  );
}
