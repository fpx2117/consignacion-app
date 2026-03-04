"use client";

import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";

interface StoreCategorySidebarProps {
    config: any;
    categories: any[];
    categoryCounts: Record<number, number>;
    selectedCategory: number | null;
    setSelectedCategory: (id: number | null) => void;
    totalProducts: number;
}

export function StoreCategorySidebar({
    config,
    categories,
    categoryCounts,
    selectedCategory,
    setSelectedCategory,
    totalProducts
}: StoreCategorySidebarProps) {
    if (!config.mostrarCategoriasEnHeader) return null;

    const { buttonRadiusClass, cardBgClass } = getThemeStyles(config.themeIdentifier);

    return (
        <aside className="hidden md:flex w-64 lg:w-72 shrink-0 flex-col gap-4 sticky top-6 self-start">
            <span className="text-sm font-black uppercase tracking-widest text-neutral-400">
                Categorías
            </span>
            <div className="flex flex-col gap-2">
                <button
                    className={cn(
                        "w-full text-left px-5 py-3.5 text-sm font-bold transition-all shadow-sm border group",
                        buttonRadiusClass,
                        selectedCategory === null
                            ? "bg-neutral-900 text-white border-transparent"
                            : cn(cardBgClass, "text-neutral-600 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900")
                    )}
                    onClick={() => setSelectedCategory(null)}
                >
                    <span className="group-hover:translate-x-1 inline-block transition-transform">Todas</span>
                    <span className="opacity-50 ml-1 font-normal">({totalProducts})</span>
                </button>
                {categories.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((cat: any) => {
                    const count = categoryCounts[cat.id] || 0;
                    if (count === 0) return null;

                    return (
                        <button
                            key={cat.id}
                            className={cn(
                                "w-full text-left px-5 py-3.5 text-sm font-bold transition-all shadow-sm border group",
                                buttonRadiusClass,
                                selectedCategory === cat.id
                                    ? "bg-neutral-900 text-white border-transparent"
                                    : cn(cardBgClass, "text-neutral-600 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900")
                            )}
                            onClick={() => setSelectedCategory(cat.id)}
                        >
                            <span className="group-hover:translate-x-1 inline-block transition-transform line-clamp-2">{cat.nombre}</span>
                            <span className="opacity-50 ml-1 font-normal">({count})</span>
                        </button>
                    )
                })}
            </div>
        </aside>
    );
}
