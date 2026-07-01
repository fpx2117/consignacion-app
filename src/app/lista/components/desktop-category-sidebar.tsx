"use client";

import * as React from "react";
import { ChevronRight, LayoutGrid, Tag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import type { PublicCatalogCategory, PublicCatalogProduct } from "@/lib/types";

interface DesktopCategorySidebarProps {
    categories: PublicCatalogCategory[];
    allProducts: PublicCatalogProduct[];
    selectedCategory: number | null;
    selectedSubcategory: number | null;
    onSelectCategory: (id: number | null) => void;
    onSelectSubcategory: (id: number | null) => void;
    totalProducts: number;
}

export function DesktopCategorySidebar({
    categories,
    allProducts,
    selectedCategory,
    selectedSubcategory,
    onSelectCategory,
    onSelectSubcategory,
    totalProducts,
}: DesktopCategorySidebarProps) {
    // Contar productos por categoría y subcategoría (solo con stock)
    const categoryCounts = React.useMemo(() => {
        return allProducts.reduce<Record<number, number>>((acc, p) => {
            if (p.categoriaId !== null) {
                acc[p.categoriaId] = (acc[p.categoriaId] || 0) + 1;
            }
            return acc;
        }, {});
    }, [allProducts]);

    const subcategoryCounts = React.useMemo(() => {
        return allProducts.reduce<Record<number, number>>((acc, p) => {
            if (p.subcategoriaId !== null) {
                acc[p.subcategoriaId] = (acc[p.subcategoriaId] || 0) + 1;
            }
            return acc;
        }, {});
    }, [allProducts]);

    // Virtuales siempre visibles, reales solo con productos
    const activeCategories = categories.filter((c: any) => {
        if (c.isVirtual) return true;
        return (categoryCounts[c.id] || 0) > 0;
    });

    return (
        <aside className="hidden lg:flex w-60 xl:w-64 shrink-0 flex-col gap-0.5 sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto pb-6 pr-1 scrollbar-themed">
            {/* Header del sidebar */}
            <div className="mb-3 px-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--store-muted,#8A8F98)]">
                    Categorías
                </h3>
            </div>

            {/* Todas */}
            <SidebarItem
                label="Todos los productos"
                count={totalProducts}
                isActive={selectedCategory === null}
                icon={<LayoutGrid className="h-3.5 w-3.5" />}
                onClick={() => {
                    onSelectCategory(null);
                    onSelectSubcategory(null);
                }}
            />

            {/* Separador */}
            <div className="h-px bg-gray-100 my-2 mx-2" />

            {/* Categorías con subcategorías expandibles */}
            {activeCategories.map((cat) => {
                const count = (cat as any).isVirtual ? ((cat as any).productIds?.length || 0) : (categoryCounts[cat.id] || 0);
                const isActive = selectedCategory === cat.id;
                const hasSubs = cat.subcategorias && cat.subcategorias.length > 0;
                const activeSubs = hasSubs
                    ? cat.subcategorias.filter((s) => (subcategoryCounts[s.id] || 0) > 0)
                    : [];

                return (
                    <div key={cat.id}>
                        {/* Botón de categoría */}
                        <button
                            onClick={() => {
                                if (isActive) {
                                    onSelectCategory(null);
                                    onSelectSubcategory(null);
                                } else {
                                    onSelectCategory(cat.id);
                                    onSelectSubcategory(null);
                                }
                            }}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all duration-150 group",
                                isActive
                                    ? "text-white"
                                    : "text-[var(--store-text,#0F172A)] hover:bg-gray-100"
                            )}
                            style={isActive ? { backgroundColor: "var(--store-primary,#007AFF)" } : undefined}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Tag
                                    className={cn(
                                        "h-3.5 w-3.5 flex-shrink-0",
                                        isActive ? "text-white/80" : "text-[var(--store-muted,#8A8F98)]"
                                    )}
                                />
                                <span className="truncate">{cat.nombre}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span
                                    className={cn(
                                        "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                                        isActive
                                            ? "bg-white/20 text-white"
                                            : "bg-gray-100 text-[var(--store-muted,#8A8F98)]"
                                    )}
                                >
                                    {count}
                                </span>
                                {activeSubs.length > 0 && (
                                    <ChevronRight
                                        className={cn(
                                            "h-3.5 w-3.5 transition-transform duration-200",
                                            isActive ? "rotate-90 text-white/80" : "text-gray-400"
                                        )}
                                    />
                                )}
                            </div>
                        </button>

                        {/* Subcategorías expandibles */}
                        <AnimatePresence initial={false}>
                            {isActive && activeSubs.length > 0 && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                >
                                    <div className="ml-3 mt-0.5 mb-1 pl-3 border-l-2 border-[var(--store-primary,#007AFF)]/20 space-y-0.5">
                                        {/* "Todos de esta categoría" */}
                                        <button
                                            onClick={() => onSelectSubcategory(null)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-colors",
                                                selectedSubcategory === null
                                                    ? "text-[var(--store-primary,#007AFF)] bg-[var(--store-primary,#007AFF)]/8 font-bold"
                                                    : "text-[var(--store-muted,#8A8F98)] hover:text-[var(--store-text,#0F172A)] hover:bg-gray-50"
                                            )}
                                        >
                                            <span>Todo {cat.nombre}</span>
                                            <span className="text-[10px] opacity-60">{count}</span>
                                        </button>

                                        {activeSubs.map((sub) => {
                                            const subCount = subcategoryCounts[sub.id] || 0;
                                            const isSubActive = selectedSubcategory === sub.id;

                                            return (
                                                <button
                                                    key={sub.id}
                                                    onClick={() =>
                                                        onSelectSubcategory(isSubActive ? null : sub.id)
                                                    }
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-colors",
                                                        isSubActive
                                                            ? "text-[var(--store-primary,#007AFF)] bg-[var(--store-primary,#007AFF)]/8 font-bold"
                                                            : "text-[var(--store-muted,#8A8F98)] hover:text-[var(--store-text,#0F172A)] hover:bg-gray-50"
                                                    )}
                                                >
                                                    <span className="truncate">{sub.nombre}</span>
                                                    <span
                                                        className={cn(
                                                            "text-[10px] px-1 py-0.5 rounded-full flex-shrink-0",
                                                            isSubActive
                                                                ? "text-[var(--store-primary,#007AFF)]"
                                                                : "text-gray-400"
                                                        )}
                                                    >
                                                        {subCount}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </aside>
    );
}

// ── Componente auxiliar para item del sidebar ──
function SidebarItem({
    label,
    count,
    isActive,
    icon,
    onClick,
}: {
    label: string;
    count: number;
    isActive: boolean;
    icon?: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all duration-150",
                isActive
                    ? "text-white"
                    : "text-[var(--store-text,#0F172A)] hover:bg-gray-100"
            )}
            style={isActive ? { backgroundColor: "var(--store-primary,#007AFF)" } : undefined}
        >
            <div className="flex items-center gap-2">
                {icon && (
                    <span className={isActive ? "text-white/80" : "text-[var(--store-muted,#8A8F98)]"}>
                        {icon}
                    </span>
                )}
                <span>{label}</span>
            </div>
            <span
                className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                    isActive
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-[var(--store-muted,#8A8F98)]"
                )}
            >
                {count}
            </span>
        </button>
    );
}
