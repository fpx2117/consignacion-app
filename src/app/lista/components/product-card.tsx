/* eslint-disable */
// @ts-nocheck
"use client";

import { ShoppingCart, CheckCircle2, XCircle, PackageOpen, Eye } from "lucide-react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";

interface ProductCardProps {
    product: any;
    config: any;
    isConsigne: boolean;
    viewMode: "grid" | "list";
    onAddToCart: (product: any) => void;
    onViewProduct?: (product: any) => void;
    index: number;
}

export function ProductCard({
    product,
    config,
    isConsigne,
    viewMode,
    onAddToCart,
    onViewProduct,
    index
}: ProductCardProps) {
    const { radiusClass, buttonHoverClass, cardBgClass } = getThemeStyles(config.themeIdentifier);
    const isGrid = viewMode === "grid";

    const basePrice = Number(product.precioVenta);
    const displayedPrice = isConsigne
        ? basePrice * (1 + (config.porcentajeAumentoConsignacion / 100))
        : basePrice;
    const isAvailable = product.stockDisponibleUnits > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (index % 8) * 0.05 }}
            className="h-full"
        >
            <Card
                onClick={() => onViewProduct?.(product)}
                className={cn(
                    "overflow-hidden border border-neutral-200/60 transition-all duration-500 h-full flex group cursor-pointer relative",
                    cardBgClass,
                    radiusClass,
                    isGrid ? "flex-col shadow-sm hover:shadow-2xl" : "flex-row h-36 p-2 items-center shadow-md hover:shadow-lg"
                )}
            >
                {/* Contenedor de la Imagen */}
                <div className={cn(
                    "relative overflow-hidden shrink-0 flex items-center justify-center bg-black/5",
                    isGrid ? "w-full aspect-square border-b border-border/10" : "h-full aspect-square",
                    (!isGrid) ? "rounded-xl" : ""
                )}>
                    {product.imagenUrl ? (
                        <>
                            <img
                                src={product.imagenUrl}
                                alt={product.nombre}
                                className="w-full h-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-110"
                            />
                            {/* Overlay "Ver detalle" */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500 flex items-center justify-center">
                                <span className={cn(
                                    "bg-white/95 text-neutral-900 text-[11px] uppercase tracking-widest font-bold px-5 py-2.5 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0 backdrop-blur-md shadow-lg hidden sm:flex items-center gap-2",
                                    radiusClass
                                )}>
                                    <Eye className="h-3 w-3" /> Ver Detalle
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-10">
                            <PackageOpen className="h-12 w-12" />
                        </div>
                    )}

                    {/* Badge de Stock */}
                    {isGrid && (
                        <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
                            {isAvailable ? (
                                <Badge className="bg-emerald-500 text-white border-transparent px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm text-[10px] font-black uppercase tracking-wider">
                                    <CheckCircle2 className="h-3 w-3" /> STOCK
                                </Badge>
                            ) : (
                                <Badge variant="destructive" className="bg-neutral-900 text-white border-transparent px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm text-[10px] font-black uppercase tracking-wider">
                                    <XCircle className="h-3 w-3" /> AGOTADO
                                </Badge>
                            )}
                        </div>
                    )}
                </div>

                {/* Contenedor de la Información */}
                <div className={cn(
                    "flex flex-col flex-1 gap-1 sm:gap-2",
                    isGrid ? "p-3 sm:p-4 lg:p-5 mt-auto z-10" : "px-3 sm:px-5 py-2 justify-center h-full",
                    cardBgClass
                )}>
                    <div>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1 block">
                            {product.categoria?.nombre || "Sin Categoría"}
                        </span>
                        <h3 className={cn(
                            "font-bold leading-snug text-neutral-900 group-hover:text-neutral-600 transition-colors",
                            isGrid ? "text-sm sm:text-base lg:text-lg line-clamp-2" : "text-base line-clamp-1"
                        )}>
                            {product.nombre}
                        </h3>

                        {!isGrid && (
                            <span className={cn("text-xs font-bold mt-1.5 block uppercase tracking-wider", isAvailable ? "text-emerald-500" : "text-neutral-400")}>
                                {isAvailable ? "En stock" : "Agotado"}
                            </span>
                        )}
                    </div>

                    <div className={cn(
                        "flex items-center justify-between gap-1.5 sm:gap-4",
                        isGrid ? "mt-2 sm:mt-4" : "mt-auto"
                    )}>
                        <div className="flex flex-col min-w-0">
                            <span className="text-base sm:text-xl font-black text-neutral-900 tracking-tight truncate">
                                ${displayedPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                            {isConsigne && (
                                <span className="text-[10px] sm:text-xs font-semibold text-neutral-400 line-through">
                                    ${basePrice.toLocaleString('es-AR')}
                                </span>
                            )}
                        </div>

                        {config.whatsappNumber && (
                            <Button
                                size="icon"
                                variant="outline"
                                className={cn(
                                    "h-8 w-8 sm:h-10 sm:w-10 border-emerald-200 hover:bg-emerald-50 text-emerald-600 transition-all duration-300 shrink-0",
                                    radiusClass
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const template = config.whatsappMessage || "Hola, estoy buscando {nombre_producto}";
                                    const message = template.replace("{nombre_producto}", product.nombre);
                                    const url = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
                                    window.open(url, '_blank');
                                }}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 sm:h-5 sm:w-5">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </Button>
                        )}

                        {config.convertirTienda && (
                            <Button
                                size="icon"
                                className={cn(
                                    "font-black shadow-md transition-all duration-300 shrink-0",
                                    radiusClass,
                                    buttonHoverClass,
                                    isGrid
                                        ? "h-8 w-8 sm:h-10 sm:w-10 bg-neutral-900 text-white"
                                        : "h-10 w-10 bg-neutral-900 text-white"
                                )}
                                disabled={!isAvailable}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddToCart(product);
                                }}
                            >
                                <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}