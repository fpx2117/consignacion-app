/* eslint-disable */
// @ts-nocheck
"use client";

import { Search, Grid, List as ListIcon, Zap, PackageOpen, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

                    {/* Ordenar Por (Dropdown Shadcn) */}
                    <div className="flex-1 sm:flex-none">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className={cn(
                                "h-10 sm:h-11 px-3 sm:px-4 shadow-sm min-w-0 flex items-center gap-2 text-neutral-900 border-neutral-200",
                                cardBgClass,
                                inputRadiusClass
                            )}>
                                <SlidersHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-neutral-500 shrink-0" />
                                <SelectValue placeholder="Ordenar por" className="font-semibold text-neutral-900 text-xs sm:text-sm mr-auto block" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl overflow-hidden">
                                <SelectItem value="relevance" className="text-xs sm:text-sm font-semibold">Relevancia</SelectItem>
                                <SelectItem value="price_asc" className="text-xs sm:text-sm font-semibold">Menor precio</SelectItem>
                                <SelectItem value="price_desc" className="text-xs sm:text-sm font-semibold">Mayor precio</SelectItem>
                                <SelectItem value="name_asc" className="text-xs sm:text-sm font-semibold">A-Z</SelectItem>
                                <SelectItem value="name_desc" className="text-xs sm:text-sm font-semibold">Z-A</SelectItem>
                            </SelectContent>
                        </Select>
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

            {/* Fila 2: Categorías Dinámicas (Sólo Mobile) */}
            {config.mostrarCategoriasEnHeader && (
                <div className="flex md:hidden flex-col gap-2 pb-4 border-b border-neutral-100/50">
                    <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                        Categorías
                    </span>
                    <Select
                        value={selectedCategory === null ? "all" : selectedCategory.toString()}
                        onValueChange={(val) => setSelectedCategory(val === "all" ? null : Number(val))}
                    >
                        <SelectTrigger className={cn("h-11 px-4 text-sm font-bold border-neutral-200 shadow-sm w-full text-neutral-900", cardBgClass, inputRadiusClass)}>
                            <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl overflow-hidden">
                            <SelectItem value="all">Todas ({products.length})</SelectItem>
                            {categories.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((cat: any) => {
                                const count = categoryCounts[cat.id] || 0;
                                if (count === 0) return null;
                                return (
                                    <SelectItem key={cat.id} value={cat.id.toString()}>
                                        {cat.nombre} <span className="opacity-50 font-normal">({count})</span>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
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