"use client";

import { cn } from "@/lib/utils";
import type { PublicCatalogCategory, PublicCatalogConfig, PublicCatalogProduct } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface StoreCategorySidebarProps {
    config: PublicCatalogConfig;
    categories: PublicCatalogCategory[];
    categoryCounts: Record<number, number>;
    selectedCategory: number | null;
    setSelectedCategory: (id: number | null) => void;
    selectedSubcategory: number | null;
    setSelectedSubcategory: (id: number | null) => void;
    totalProducts: number;
    allProducts: PublicCatalogProduct[];
}

export function StoreCategorySidebar({
    config,
    categories,
    categoryCounts,
    selectedCategory,
    setSelectedCategory,
    selectedSubcategory,
    setSelectedSubcategory,
    totalProducts,
    allProducts = [],
}: StoreCategorySidebarProps) {
    if (!config.mostrarCategoriasEnHeader) return null;

    const subcategoryCounts = allProducts.reduce<Record<number, number>>((acc, product) => {
        if (product.subcategoriaId !== null) {
            acc[product.subcategoriaId] = (acc[product.subcategoriaId] || 0) + 1;
        }
        return acc;
    }, {});

    const sortedCategories = [...categories].sort((a, b) => a.nombre.localeCompare(b.nombre));

    return (
        <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-1 sticky top-24 self-start">
            <div className="mb-2 px-1">
                <h3 className="text-sm font-semibold text-gray-900">Categorías</h3>
                <p className="text-xs text-gray-400 mt-0.5">{totalProducts} productos</p>
            </div>

            <button
                onClick={() => {
                    setSelectedCategory(null);
                    setSelectedSubcategory(null);
                }}
                className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    selectedCategory === null
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
            >
                <span>Todas</span>
                <span className="text-xs text-gray-400">({totalProducts})</span>
            </button>

            {sortedCategories.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                if (count === 0) return null;

                const isSelected = selectedCategory === cat.id;
                const hasSubcategories = cat.subcategorias && cat.subcategorias.length > 0;

                return (
                    <div key={cat.id}>
                        <button
                            onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                            className={cn(
                                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                                isSelected
                                    ? "bg-gray-100 text-gray-900"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            )}
                        >
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{cat.nombre}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs text-gray-400">({count})</span>
                                {hasSubcategories && (
                                    <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", isSelected && "rotate-180")} />
                                )}
                            </div>
                        </button>

                        {isSelected && hasSubcategories && (
                            <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-2">
                                <button
                                    onClick={() => setSelectedSubcategory(null)}
                                    className={cn(
                                        "block w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                                        selectedSubcategory === null
                                            ? "bg-gray-100 text-gray-900"
                                            : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    Todo {cat.nombre}
                                </button>
                                {cat.subcategorias.map((sub) => {
                                    const subCount = subcategoryCounts[sub.id] || 0;
                                    if (subCount === 0) return null;
                                    const isSubSelected = selectedSubcategory === sub.id;

                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => setSelectedSubcategory(isSubSelected ? null : sub.id)}
                                            className={cn(
                                                "block w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                                                isSubSelected
                                                    ? "bg-gray-100 text-gray-900"
                                                    : "text-gray-500 hover:text-gray-700"
                                            )}
                                        >
                                            <span className="truncate">{sub.nombre}</span>
                                            <span className="ml-1 text-gray-400">({subCount})</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </aside>
    );
}
