/* eslint-disable */
// @ts-nocheck
"use client";

import { Search, Grid, List as ListIcon, Zap, PackageOpen, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";

interface StoreFiltersProps {
    config: any;
    products: any[];
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    viewMode: "grid" | "list";
    setViewMode: (mode: "grid" | "list") => void;
    categories: any[];
    selectedCategory: number | null;
    setSelectedCategory: (id: number | null) => void;
    isConsigne: boolean;
    setIsConsigne: (val: boolean) => void;
    sortBy: string;
    setSortBy: (val: string) => void;
}

export function StoreFilters({
    config,
    products,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    categories,
    selectedCategory,
    setSelectedCategory,
    isConsigne,
    setIsConsigne,
    sortBy,
    setSortBy
}: StoreFiltersProps) {
    const { inputRadiusClass, buttonRadiusClass, cardBgClass } = getThemeStyles(config.themeIdentifier);

    // Calcular cuántos productos hay por categoría para mostrar el contador
    const categoryCounts = products.reduce((acc, product) => {
        const catId = product.categoriaId;
        acc[catId] = (acc[catId] || 0) + 1;
        return acc;
    }, {} as Record<number, number>);

    return (
        <section className="flex flex-col gap-5">
            {/* Fila 1: Buscador Principal y Controles de Vista */}
            <div className="flex flex-col gap-3">

                {/* Buscador E-commerce */}
                <div className="relative w-full group">
                    <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-neutral-400 group-focus-within:text-neutral-900 transition-colors" />
                    <Input
                        placeholder="Buscar producto..."
                        className={cn(
                            "pl-10 sm:pl-12 h-11 sm:h-14 text-sm sm:text-base text-neutral-900 border-neutral-200 shadow-sm focus-visible:ring-0 focus-visible:border-neutral-900 transition-all",
                            cardBgClass,
                            config.themeIdentifier === "minimal" || config.themeIdentifier === "luxury"
                                ? "border-x-0 border-t-0 border-b-2 rounded-none bg-transparent px-0 pl-10"
                                : inputRadiusClass
                        )}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Herramientas (Vista y Orden) */}
                <div className="flex items-center justify-between gap-3">

                    {/* Ordenar Por (Dropdown Nativo Estilizado) */}
                    <div className={cn(
                        "relative flex items-center border border-neutral-200 h-10 sm:h-11 px-3 sm:px-4 shadow-sm flex-1 sm:flex-none",
                        cardBgClass,
                        inputRadiusClass
                    )}>
                        <SlidersHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 mr-2 shrink-0" />
                        <select
                            className="bg-transparent text-xs sm:text-sm font-semibold text-neutral-700 focus:outline-none appearance-none cursor-pointer pr-4 w-full"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="relevance">Relevancia</option>
                            <option value="price_asc">Menor precio</option>
                            <option value="price_desc">Mayor precio</option>
                            <option value="name_asc">A-Z</option>
                            <option value="name_desc">Z-A</option>
                        </select>
                    </div>

                    {/* Toggle de Vista */}
                    <div className={cn(
                        "flex items-center bg-neutral-900 p-1 shadow-sm shrink-0",
                        buttonRadiusClass
                    )}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-9 sm:h-9 sm:w-10 transition-all",
                                buttonRadiusClass,
                                viewMode === "grid" ? cn(cardBgClass, "text-neutral-900 shadow-sm") : "text-neutral-400 hover:text-white"
                            )}
                            onClick={() => setViewMode("grid")}
                            title="Vista Cuadrícula"
                        >
                            <Grid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-9 sm:h-9 sm:w-10 transition-all",
                                buttonRadiusClass,
                                viewMode === "list" ? cn(cardBgClass, "text-neutral-900 shadow-sm") : "text-neutral-400 hover:text-white"
                            )}
                            onClick={() => setViewMode("list")}
                            title="Vista Lista"
                        >
                            <ListIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Fila 2: Categorías Dinámicas con Contadores */}
            {config.mostrarCategoriasEnHeader && (
                <div className="flex items-center gap-2 pb-2 overflow-x-auto scrollbar-hide border-b border-neutral-100/50 -mx-1 px-1">
                    <span className="hidden sm:block text-xs font-black uppercase tracking-widest text-neutral-400 mr-2 shrink-0">
                        Categorías
                    </span>
                    <Badge
                        variant="outline"
                        className={cn(
                            "px-5 py-2 cursor-pointer text-sm font-bold transition-all hover:scale-105 shadow-sm border shrink-0",
                            buttonRadiusClass,
                            selectedCategory === null
                                ? "bg-neutral-900 text-white border-transparent"
                                : cn(cardBgClass, "text-neutral-600 border-neutral-200 hover:bg-neutral-50")
                        )}
                        onClick={() => setSelectedCategory(null)}
                    >
                        Todas ({products.length})
                    </Badge>
                    {categories.map((cat: any) => {
                        const count = categoryCounts[cat.id] || 0;
                        if (count === 0) return null; // Ocultar categorías vacías para mantener limpieza

                        return (
                            <Badge
                                key={cat.id}
                                variant="outline"
                                className={cn(
                                    "px-5 py-2 cursor-pointer text-sm font-bold transition-all hover:scale-105 shadow-sm whitespace-nowrap border shrink-0",
                                    buttonRadiusClass,
                                    selectedCategory === cat.id
                                        ? "bg-neutral-900 text-white border-transparent"
                                        : cn(cardBgClass, "text-neutral-600 border-neutral-200 hover:bg-neutral-50")
                                )}
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.nombre} <span className="opacity-50 ml-1 font-normal">({count})</span>
                            </Badge>
                        )
                    })}
                </div>
            )}

            {/* Fila 3: Switch de Consignación */}
            {config.mostrarPreciosConsignacion && config.porcentajeAumentoConsignacion > 0 && (
                <div className="flex justify-start w-full mt-2">
                    <div className={cn(
                        "flex p-1 w-full md:max-w-[400px] border border-neutral-200 shadow-inner backdrop-blur-sm",
                        cardBgClass,
                        inputRadiusClass
                    )}>
                        <button
                            onClick={() => setIsConsigne(false)}
                            className={cn(
                                "flex-1 py-2 px-4 text-xs sm:text-sm font-black tracking-tight transition-all duration-300 flex items-center justify-center gap-2",
                                inputRadiusClass,
                                !isConsigne
                                    ? "bg-white text-neutral-900 shadow-sm border border-neutral-200/50 scale-[1.02]"
                                    : "text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/50"
                            )}
                        >
                            <PackageOpen className="h-4 w-4" />
                            GENERAL
                        </button>
                        <button
                            onClick={() => setIsConsigne(true)}
                            className={cn(
                                "flex-1 py-2 px-4 text-xs sm:text-sm font-black tracking-tight transition-all duration-300 flex items-center justify-center gap-2",
                                inputRadiusClass,
                                isConsigne
                                    ? "bg-neutral-900 text-white shadow-sm scale-[1.02]"
                                    : "text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/50"
                            )}
                        >
                            <Zap className="h-4 w-4" />
                            CONSIGNACIÓN
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}