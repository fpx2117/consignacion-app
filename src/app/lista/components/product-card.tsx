"use client";

import Image from "next/image";
import { Plus, Minus, PackageOpen } from "lucide-react";
import { motion } from "motion/react";
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
    /** Cantidad actual en el carrito (0 si no está agregado) */
    cartQuantity?: number;
    /** Callback para actualizar cantidad directamente */
    onUpdateCartQuantity?: (productId: number, newQty: number) => void;
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
    cartQuantity = 0,
    onUpdateCartQuantity,
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
    const inCart = cartQuantity > 0;
    const maxStock = Math.max(0, product.stockDisponibleUnits || 0);

    const ols = config.onlineStoreConfig;
    const showImages = ols?.catalog?.showProductImages ?? true;
    const showPrices = ols?.catalog?.showPrices ?? true;
    const showStock = ols?.catalog?.showStock ?? false;
    const addBtnPosition = ols?.catalog?.addButtonPosition ?? "floating";

    const formatPrice = (val: number) =>
        `$${val.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onUpdateCartQuantity) {
            onUpdateCartQuantity(product.id, 1);
        } else {
            onAddToCart(product, 1);
        }
    };

    const handleIncrement = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = Math.min(cartQuantity + 1, maxStock);
        if (onUpdateCartQuantity) {
            onUpdateCartQuantity(product.id, next);
        } else {
            onAddToCart(product, next - cartQuantity);
        }
    };

    const handleDecrement = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = cartQuantity - 1;
        if (onUpdateCartQuantity) {
            // 0 dispara remove en el padre
            onUpdateCartQuantity(product.id, next);
        }
    };

    // ══════════════════════════════════════════
    //  Stepper de cantidad (reutilizado en grid y list)
    // ══════════════════════════════════════════
    const QuantityStepper = ({ size = "sm" }: { size?: "sm" | "lg" }) => (
        <div
            className={cn(
                "flex items-center rounded-full text-white font-semibold select-none",
                size === "lg" ? "h-10 px-1 gap-1" : "h-9 px-0.5 gap-0.5"
            )}
            style={{ backgroundColor: "var(--store-primary,#007AFF)" }}
        >
            <button
                onClick={handleDecrement}
                className={cn(
                    "flex items-center justify-center rounded-full hover:bg-white/20 active:scale-90 transition-all",
                    size === "lg" ? "h-8 w-8" : "h-7 w-7"
                )}
                aria-label="Reducir cantidad"
            >
                <Minus className={cn(size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")} strokeWidth={2.5} />
            </button>
            <span className={cn("text-center tabular-nums", size === "lg" ? "w-8 text-sm" : "w-7 text-sm")}>
                {cartQuantity}
            </span>
            <button
                onClick={handleIncrement}
                disabled={cartQuantity >= maxStock}
                className={cn(
                    "flex items-center justify-center rounded-full hover:bg-white/20 active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                    size === "lg" ? "h-8 w-8" : "h-7 w-7"
                )}
                aria-label="Aumentar cantidad"
            >
                <Plus className={cn(size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")} strokeWidth={2.5} />
            </button>
        </div>
    );

    // ══════════════════════════════════════════
    //  GRID VIEW
    // ══════════════════════════════════════════
    if (isGrid) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ delay: (index % 8) * 0.04, duration: 0.3 }}
                className="h-full"
            >
                <div
                    onClick={() => onViewProduct?.(product)}
                    className={cn(
                        "group relative flex h-full cursor-pointer flex-col overflow-hidden",
                        "rounded-2xl bg-[var(--store-surface,#FFFFFF)]",
                        "shadow-sm hover:shadow-md transition-all duration-200",
                        !isAvailable && "opacity-70"
                    )}
                >
                    {/* ── Imagen ── */}
                    {showImages && (
                        <div className={cn(
                            "relative w-full overflow-hidden bg-gray-50",
                            compact ? "aspect-square" : "aspect-[4/5]"
                        )}>
                            {product.imagenUrl ? (
                                <Image
                                    src={product.imagenUrl}
                                    alt={product.nombre}
                                    fill
                                    unoptimized
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-gray-200">
                                    <PackageOpen className="h-12 w-12" />
                                </div>
                            )}

                            {/* Badges */}
                            <div className="absolute left-2 top-2 flex flex-col gap-1">
                                {!isAvailable && (
                                    <Badge className="bg-gray-700 hover:bg-gray-700 text-white border-0 text-[10px] px-2 py-0.5">Agotado</Badge>
                                )}
                                {descuento && isAvailable && (
                                    <Badge className="bg-red-500 hover:bg-red-500 text-white border-0 text-[10px] font-bold px-2 py-0.5">-{Math.abs(descuento.porcentaje)}%</Badge>
                                )}
                            </div>

                            {/* Botón flotante: stepper o "+" */}
                            {isAvailable && cartEnabled && addBtnPosition === "floating" && (
                                <div className="absolute bottom-2 right-2 z-10">
                                    {inCart ? (
                                        <QuantityStepper size="lg" />
                                    ) : (
                                        <button
                                            onClick={handleAdd}
                                            aria-label="Agregar al carrito"
                                            className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200"
                                            style={{ backgroundColor: "var(--store-primary,#007AFF)" }}
                                        >
                                            <Plus className="h-5 w-5" strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Contenido ── */}
                    <div className={cn("flex flex-1 flex-col p-3", !showImages && "pt-4")}>
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--store-text,#0F172A)] group-hover:opacity-75 transition-opacity">
                            {product.nombre}
                        </h3>

                        {showStock && (
                            <p className={cn("text-xs mt-1", isAvailable ? "text-emerald-600" : "text-red-500")}>
                                {isAvailable ? `${product.stockDisponibleUnits} en stock` : "Sin stock"}
                            </p>
                        )}

                        <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                            {showPrices && (
                                <div className="flex flex-col">
                                    <span className="text-base font-bold text-[var(--store-text,#0F172A)]">
                                        {formatPrice(finalPrice)}
                                    </span>
                                    {descuento && (
                                        <span className="text-xs text-[var(--store-muted,#8A8F98)] line-through">
                                            {formatPrice(descuento.precioOriginal)}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Botón abajo: stepper o "+" */}
                            {isAvailable && cartEnabled && (addBtnPosition === "below" || !showImages) && (
                                <div className="flex-shrink-0">
                                    {inCart ? (
                                        <QuantityStepper size="sm" />
                                    ) : (
                                        <button
                                            onClick={handleAdd}
                                            aria-label="Agregar al carrito"
                                            className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md hover:scale-110 active:scale-95 transition-all"
                                            style={{ backgroundColor: "var(--store-primary,#007AFF)" }}
                                        >
                                            <Plus className="h-4 w-4" strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    // ══════════════════════════════════════════
    //  LIST VIEW
    // ══════════════════════════════════════════
    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: (index % 4) * 0.05 }}
        >
            <div
                onClick={() => onViewProduct?.(product)}
                className={cn(
                    "group flex cursor-pointer overflow-hidden rounded-2xl",
                    "bg-[var(--store-surface,#FFFFFF)] shadow-sm hover:shadow-md",
                    "transition-all duration-200",
                    !isAvailable && "opacity-70"
                )}
            >
                {showImages && (
                    <div className="relative w-28 sm:w-36 shrink-0 overflow-hidden bg-gray-50">
                        {product.imagenUrl ? (
                            <Image src={product.imagenUrl} alt={product.nombre} fill unoptimized sizes="144px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                            <div className="flex h-full w-full min-h-[100px] items-center justify-center text-gray-200"><PackageOpen className="h-8 w-8" /></div>
                        )}
                        <div className="absolute left-2 top-2 flex flex-col gap-1">
                            {!isAvailable && <Badge className="bg-gray-700 text-white border-0 text-[10px] px-2">Agotado</Badge>}
                            {descuento && isAvailable && <Badge className="bg-red-500 text-white border-0 text-[10px] font-bold px-2">-{Math.abs(descuento.porcentaje)}%</Badge>}
                        </div>
                    </div>
                )}

                <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
                    <div>
                        <h3 className="text-sm sm:text-base font-semibold text-[var(--store-text,#0F172A)] line-clamp-2">{product.nombre}</h3>
                        {showStock && (
                            <p className={cn("text-xs mt-1", isAvailable ? "text-emerald-600" : "text-red-500")}>
                                {isAvailable ? `${product.stockDisponibleUnits} en stock` : "Sin stock"}
                            </p>
                        )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                        {showPrices && (
                            <div>
                                {descuento ? (
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-base font-bold text-[var(--store-text,#0F172A)]">{formatPrice(finalPrice)}</span>
                                        <span className="text-xs text-[var(--store-muted,#8A8F98)] line-through">{formatPrice(descuento.precioOriginal)}</span>
                                    </div>
                                ) : (
                                    <span className="text-base font-bold text-[var(--store-text,#0F172A)]">{formatPrice(displayedPrice)}</span>
                                )}
                            </div>
                        )}
                        {cartEnabled && isAvailable && (
                            <div className="flex-shrink-0">
                                {inCart ? (
                                    <QuantityStepper size="sm" />
                                ) : (
                                    <button
                                        onClick={handleAdd}
                                        className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md hover:scale-110 active:scale-95 transition-all"
                                        style={{ backgroundColor: "var(--store-primary,#007AFF)" }}
                                        aria-label="Agregar al carrito"
                                    >
                                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
