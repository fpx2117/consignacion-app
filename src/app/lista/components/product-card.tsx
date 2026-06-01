"use client";

import Image from "next/image";
import { ShoppingCart, Eye, PackageOpen } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PublicCatalogConfig, PublicCatalogProduct } from "@/lib/types";

interface ProductCardProps {
    product: PublicCatalogProduct;
    config: PublicCatalogConfig;
    isConsigne: boolean;
    viewMode: "grid" | "list";
    onAddToCart: (product: PublicCatalogProduct, quantity?: number) => void;
    onViewProduct?: (product: PublicCatalogProduct) => void;
    index: number;
    compact?: boolean;
}

export function ProductCard({
    product,
    config,
    isConsigne,
    viewMode,
    onAddToCart,
    onViewProduct,
    index,
    compact = false,
}: ProductCardProps) {
    const isGrid = viewMode === "grid";
    const basePrice = Number(product.precioVenta);
    const pct = Number(config.porcentajeAumentoConsignacion) || 0;
    const displayedPrice = isConsigne ? basePrice * (1 + pct / 100) : basePrice;
    const isAvailable = product.stockDisponibleUnits > 0;
    const descuento = product.descuentoEfectivo;
    const cartEnabled = Boolean(config.convertirTienda);
    const finalPrice = descuento ? descuento.precioFinal : displayedPrice;

    const formatPrice = (val: number) =>
        val.toLocaleString("es-AR", { minimumFractionDigits: 2 });

    if (isGrid) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (index % 8) * 0.04 }}
                className="h-full"
            >
                <div
                    onClick={() => onViewProduct?.(product)}
                    className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] transition-all duration-300 hover:shadow-md hover:ring-black/[0.08]"
                >
                    {/* Image */}
                    <div className={cn(
                        "relative w-full overflow-hidden bg-gray-50",
                        compact ? "aspect-square" : "aspect-[4/5]",
                    )}>
                        {product.imagenUrl ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={product.imagenUrl}
                                        alt={product.nombre}
                                        fill
                                        unoptimized
                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                </div>
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-300">
                                <PackageOpen className="h-10 w-10" />
                            </div>
                        )}

                        {/* Badges */}
                        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                            {!isAvailable && (
                                <Badge variant="destructive" className="bg-red-600 hover:bg-red-600 text-white border-0 text-[10px] font-medium px-2 py-0.5">
                                    Agotado
                                </Badge>
                            )}
                            {descuento && (
                                <Badge className="bg-red-500 hover:bg-red-500 text-white border-0 text-[10px] font-bold px-2 py-0.5">
                                    -{Math.abs(descuento.porcentaje)}%
                                </Badge>
                            )}
                        </div>

                        {/* Quick view overlay */}
                        <div className="absolute inset-0 flex items-end justify-end p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm backdrop-blur-sm">
                                <Eye className="h-4 w-4" />
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col p-4">
                        {product.categoria?.nombre && (
                            <span className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                                {product.categoria.nombre}
                            </span>
                        )}

                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-gray-700 transition-colors">
                            {product.nombre}
                        </h3>

                        <div className="mt-auto pt-3 flex items-end justify-between">
                            <div>
                                {descuento ? (
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-base font-bold text-gray-900">
                                            ${formatPrice(finalPrice)}
                                        </span>
                                        <span className="text-xs text-gray-400 line-through">
                                            ${formatPrice(descuento.precioOriginal)}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-base font-bold text-gray-900">
                                        ${formatPrice(displayedPrice)}
                                    </span>
                                )}
                            </div>

                            {isAvailable && cartEnabled && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddToCart(product);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white
                                               opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
                                               transition-all duration-300 active:scale-95
                                               sm:h-9 sm:w-9"
                                    style={{ backgroundColor: config.primaryColor || "#111827" }}
                                    aria-label="Agregar al carrito"
                                >
                                    <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    // List view
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (index % 4) * 0.05 }}
        >
            <div
                onClick={() => onViewProduct?.(product)}
                className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04] transition-all hover:shadow-md hover:ring-black/[0.08] sm:flex-row"
            >
                <div className="relative w-full shrink-0 overflow-hidden bg-gray-50 sm:w-56 sm:min-h-[220px]">
                    {product.imagenUrl ? (
                        <div className="relative w-full h-full min-h-[200px] sm:min-h-[220px]">
                            <Image
                                src={product.imagenUrl}
                                alt={product.nombre}
                                fill
                                unoptimized
                                sizes="(max-width: 640px) 100vw, 220px"
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                            <PackageOpen className="h-10 w-10" />
                        </div>
                    )}
                    <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                        {!isAvailable && (
                            <Badge variant="destructive" className="bg-red-600 text-white border-0 text-[10px] px-2">Agotado</Badge>
                        )}
                        {descuento && (
                            <Badge className="bg-red-500 text-white border-0 text-[10px] font-bold px-2">-{Math.abs(descuento.porcentaje)}%</Badge>
                        )}
                    </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                        {product.categoria?.nombre && (
                            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                                {product.categoria.nombre}
                            </span>
                        )}
                        <h3 className="mt-1 text-lg font-semibold text-gray-900">{product.nombre}</h3>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <div>
                            {descuento ? (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-bold text-gray-900">${formatPrice(finalPrice)}</span>
                                    <span className="text-sm text-gray-400 line-through">${formatPrice(descuento.precioOriginal)}</span>
                                </div>
                            ) : (
                                <span className="text-xl font-bold text-gray-900">${formatPrice(displayedPrice)}</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs text-gray-700 border-gray-300 bg-white hover:bg-gray-100 hover:text-gray-900 hover:border-gray-400"
                                onClick={(e) => { e.stopPropagation(); onViewProduct?.(product); }}
                            >
                                <Eye className="mr-1.5 h-3.5 w-3.5" /> Detalle
                            </Button>
                            {cartEnabled && isAvailable && (
                                <Button size="sm" className="text-xs text-white" style={{ backgroundColor: config.primaryColor || "#111827" }} onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}>
                                    <ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> Agregar
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
