"use client";

import { Search, Grid, List as ListIcon, Zap, PackageOpen, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";
import type {
  PublicCatalogCategory,
  PublicCatalogConfig,
  PublicCatalogProduct,
  PublicCatalogSortBy,
} from "@/lib/types";

import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";

interface StoreFiltersProps {
    config: PublicCatalogConfig;
    products: PublicCatalogProduct[];
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    viewMode: "grid" | "list";
    setViewMode: (mode: "grid" | "list") => void;
    categories: PublicCatalogCategory[];
    selectedCategory: number | null;
    setSelectedCategory: (id: number | null) => void;
    selectedSubcategory: number | null;
    setSelectedSubcategory: (id: number | null) => void;
    isConsigne: boolean;
    setIsConsigne: (val: boolean) => void;
    sortBy: PublicCatalogSortBy;
    setSortBy: (val: PublicCatalogSortBy) => void;
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
    selectedSubcategory,
    setSelectedSubcategory,
    isConsigne,
    setIsConsigne,
    sortBy,
    setSortBy
}: StoreFiltersProps) {
    const { inputRadiusClass, buttonRadiusClass, cardBgClass } = getThemeStyles(config.themeIdentifier);

    // Calcular cuántos productos hay por categoría/subcategoría para mostrar el contador
    const categoryCounts = products.reduce<Record<number, number>>((acc, product) => {
        const catId = product.categoriaId;
        if (catId === null) return acc;
        acc[catId] = (acc[catId] || 0) + 1;
        return acc;
    }, {});

    const subcategoryCounts = products.reduce<Record<number, number>>((acc, product) => {
        if (product.subcategoriaId !== null) {
            acc[product.subcategoriaId] = (acc[product.subcategoriaId] || 0) + 1;
        }
        return acc;
    }, {});

    return (
        <section className="flex flex-col gap-5">
            {/* Fila 1: Buscador Principal y Controles de Vista */}
            <div className="flex flex-col gap-3">

                {/* Buscador E-commerce */}
                <div className="relative w-full group">
                    <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/80 group-focus-within:text-foreground transition-colors" />
                    <Input
                        placeholder="Buscar producto..."
                        className={cn(
                            "pl-10 sm:pl-12 h-11 sm:h-14 text-sm sm:text-base text-foreground border-border shadow-sm focus-visible:ring-0 focus-visible:border-foreground transition-all",
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
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">

                    {/* Ordenar Por (Dropdown Shadcn) */}
                    <div className="w-full sm:w-auto sm:flex-1 min-w-0">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className={cn(
                                "h-10 sm:h-11 w-full px-3 sm:px-4 shadow-sm min-w-0 flex items-center gap-2 text-foreground border-border",
                                cardBgClass,
                                inputRadiusClass
                            )}>
                                <SlidersHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                                <SelectValue placeholder="Ordenar por" className="font-semibold text-foreground text-xs sm:text-sm mr-auto block" />
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
                        "ml-auto flex items-center bg-foreground p-1 shadow-sm shrink-0",
                        buttonRadiusClass
                    )}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-9 sm:h-9 sm:w-10 transition-all",
                                buttonRadiusClass,
                                viewMode === "grid" ? cn(cardBgClass, "text-foreground shadow-sm") : "text-muted-foreground/80 hover:text-[color:var(--ui-fx-white)]"
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
                                viewMode === "list" ? cn(cardBgClass, "text-foreground shadow-sm") : "text-muted-foreground/80 hover:text-[color:var(--ui-fx-white)]"
                            )}
                            onClick={() => setViewMode("list")}
                            title="Vista Lista"
                        >
                            <ListIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Fila 2: Categorías Dinámicas (Sólo Mobile) - MEJORADO con Subcategorías */}
            {config.mostrarCategoriasEnHeader && (
                <div className="flex md:hidden flex-col gap-3 pb-4 border-b border-border/40">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Categorías
                    </span>

                    <div className="flex flex-col gap-2">
                        {/* Selector de Todas */}
                        <button
                            onClick={() => {
                                setSelectedCategory(null);
                                setSelectedSubcategory(null);
                            }}
                            className={cn(
                                "flex items-center justify-between px-4 py-3 text-sm font-bold border transition-all shadow-sm",
                                inputRadiusClass,
                                selectedCategory === null
                                    ? "bg-foreground text-[color:var(--ui-fx-white)] border-transparent"
                                    : cn(cardBgClass, "text-foreground border-border")
                            )}
                        >
                            <span>Todas las categorías</span>
                            <Badge variant="secondary" className="bg-muted/55 text-muted-foreground border-none">{products.length}</Badge>
                        </button>

                        {/* Lista de Categorías con Acordeón para Subcategorías */}
                        {categories.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).map((cat) => {
                            const count = categoryCounts[cat.id] || 0;
                            if (count === 0) return null;

                            const isSelected = selectedCategory === cat.id;
                            const hasSubcategories = cat.subcategorias && cat.subcategorias.length > 0;

                            return (
                                <div key={cat.id} className="flex flex-col gap-1">
                                    <button
                                        onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                                        className={cn(
                                            "flex items-center justify-between px-4 py-3 text-sm font-bold border transition-all shadow-sm",
                                            inputRadiusClass,
                                            isSelected
                                                ? "bg-foreground text-[color:var(--ui-fx-white)] border-transparent"
                                                : cn(cardBgClass, "text-foreground border-border")
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>{cat.nombre}</span>
                                            <span className={cn("text-[10px] font-normal opacity-60", isSelected ? "text-[color:var(--ui-fx-white)]/70" : "text-muted-foreground")}>({count})</span>
                                        </div>
                                        {hasSubcategories && (
                                            <ChevronDown className={cn("h-4 w-4 transition-transform", isSelected ? "rotate-180" : "")} />
                                        )}
                                    </button>

                                    <AnimatePresence>
                                        {isSelected && hasSubcategories && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden bg-muted/30 rounded-2xl p-1 flex flex-wrap gap-1 mt-1 border border-border/70"
                                            >
                                                {/* Opción de "Ver Todo de [Categoría]" */}
                                                <button
                                                    onClick={() => setSelectedSubcategory(null)}
                                                    className={cn(
                                                        "px-3 py-1.5 text-xs font-bold rounded-xl transition-all border",
                                                        selectedSubcategory === null
                                                            ? "bg-[color:var(--store-surface)] text-foreground border-border shadow-sm"
                                                            : "text-muted-foreground/80 border-transparent hover:text-muted-foreground"
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
                                                                "px-3 py-1.5 text-xs font-bold rounded-xl transition-all border",
                                                                isSubSelected
                                                                    ? "bg-[color:var(--store-surface)] text-foreground border-border shadow-sm"
                                                                    : "text-muted-foreground/80 border-transparent hover:text-muted-foreground"
                                                            )}
                                                        >
                                                            {sub.nombre} ({subCount})
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
                </div>
            )}

            {/* Fila 3: Switch de Consignación */}
            {config.mostrarPreciosConsignacion && (config.porcentajeAumentoConsignacion ?? 0) > 0 && (
                <div className="flex justify-start w-full mt-2">
                    <div className={cn(
                        "flex p-1 w-full md:max-w-[400px] border border-border shadow-inner backdrop-blur-sm",
                        cardBgClass,
                        inputRadiusClass
                    )}>
                        <button
                            onClick={() => setIsConsigne(false)}
                            className={cn(
                                "flex-1 py-2 px-4 text-xs sm:text-sm font-black tracking-tight transition-all duration-300 flex items-center justify-center gap-2",
                                inputRadiusClass,
                                !isConsigne
                                    ? "bg-[color:var(--store-surface)] text-foreground shadow-sm border border-border/50 scale-[1.02]"
                                    : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/70"
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
                                    ? "bg-foreground text-[color:var(--ui-fx-white)] shadow-sm scale-[1.02]"
                                    : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/70"
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
