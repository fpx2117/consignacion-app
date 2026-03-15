"use client";

import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";
import type {
    PublicCatalogCategory,
    PublicCatalogConfig,
    PublicCatalogProduct,
} from "@/lib/types";

import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";

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
    allProducts = []
}: StoreCategorySidebarProps) {
    if (!config.mostrarCategoriasEnHeader) return null;

    const { buttonRadiusClass, cardBgClass } = getThemeStyles(config.themeIdentifier);

    // Calcular counts de subcategorías
    const subcategoryCounts = allProducts.reduce<Record<number, number>>((acc, product) => {
        if (product.subcategoriaId !== null) {
            acc[product.subcategoriaId] = (acc[product.subcategoriaId] || 0) + 1;
        }
        return acc;
    }, {});

    return (
        <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col gap-4 sticky top-6 self-start">
            <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/80">
                Categorías
            </span>
            <div className="flex flex-col gap-2">
                <button
                    className={cn(
                        "w-full text-left px-5 py-3.5 text-sm font-bold transition-all shadow-sm border group",
                        buttonRadiusClass,
                        selectedCategory === null
                            ? "bg-foreground text-[color:var(--ui-fx-white)] border-transparent"
                            : cn(cardBgClass, "text-muted-foreground border-border hover:bg-muted/40 hover:text-foreground")
                    )}
                    onClick={() => {
                        setSelectedCategory(null);
                        setSelectedSubcategory(null);
                    }}
                >
                    <span className="group-hover:translate-x-1 inline-block transition-transform">Todas</span>
                    <span className="opacity-50 ml-1 font-normal">({totalProducts})</span>
                </button>

                {categories.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((cat) => {
                    const count = categoryCounts[cat.id] || 0;
                    if (count === 0) return null;

                    const hasSubcategories = cat.subcategorias && cat.subcategorias.length > 0;
                    const isSelected = selectedCategory === cat.id;

                    return (
                        <div key={cat.id} className="flex flex-col gap-1">
                            <button
                                className={cn(
                                    "w-full text-left px-5 py-3.5 text-sm font-bold transition-all shadow-sm border group flex items-center justify-between",
                                    buttonRadiusClass,
                                    isSelected
                                        ? "bg-foreground text-[color:var(--ui-fx-white)] border-transparent"
                                        : cn(cardBgClass, "text-muted-foreground border-border hover:bg-muted/40 hover:text-foreground")
                                )}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="group-hover:translate-x-1 inline-block transition-transform line-clamp-2">
                                        {cat.nombre}
                                    </span>
                                    <span className="opacity-50 font-normal">({count})</span>
                                </div>
                                {hasSubcategories && (
                                    <ChevronRight
                                        className={cn(
                                            "h-4 w-4 transition-transform duration-300",
                                            isSelected ? "rotate-90" : "group-hover:translate-x-1"
                                        )}
                                    />
                                )}
                            </button>

                            <AnimatePresence>
                                {isSelected && hasSubcategories && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="overflow-hidden flex flex-col gap-1 ml-4 border-l-2 border-border/70 pl-3 py-1"
                                    >
                                        {cat.subcategorias.map((sub) => {
                                            const subCount = subcategoryCounts[sub.id] || 0;
                                            if (subCount === 0) return null;

                                            const isSubSelected = selectedSubcategory === sub.id;

                                            return (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => setSelectedSubcategory(sub.id === selectedSubcategory ? null : sub.id)}
                                                    className={cn(
                                                        "text-left px-3 py-2 text-xs font-bold transition-all flex items-center gap-2",
                                                        buttonRadiusClass,
                                                        isSubSelected
                                                            ? "bg-muted/55 text-foreground"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                                    )}
                                                >
                                                    <span className="line-clamp-1">{sub.nombre}</span>
                                                    <span className="opacity-40 font-normal">({subCount})</span>
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
