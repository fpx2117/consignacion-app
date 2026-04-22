"use client";

import Image from "next/image";
import { XCircle, ShoppingCart, PackageOpen, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";
import type {
    PublicCatalogConfig,
    PublicCatalogProduct,
} from "@/lib/types";

interface ProductModalProps {
    product: PublicCatalogProduct | null;
    isOpen: boolean;
    onClose: () => void;
    config: PublicCatalogConfig;
    isConsigne: boolean;
    onAddToCart: (product: PublicCatalogProduct, quantity: number) => void;
}

export function ProductModal({ product, isOpen, onClose, config, isConsigne, onAddToCart }: ProductModalProps) {
    const quantity = 1;

    if (!product) return null;

    const { radiusClass, buttonRadiusClass, buttonHoverClass, cardBgClass } = getThemeStyles(config?.themeIdentifier);
    const basePrice = Number(product.precioVenta);
    const displayedPrice = isConsigne
        ? basePrice * (1 + ((config.porcentajeAumentoConsignacion ?? 0) / 100))
        : basePrice;
    const isAvailable = product.stockDisponibleUnits > 0;
    const descuento = product.descuentoEfectivo;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Fondo oscuro desenfocado */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/54 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 sm:p-6"
                    >
                        {/* Contenedor del Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()} // Evita que el click cierre el modal
                            className={cn(
                                "w-full max-w-4xl max-h-[92dvh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative",
                                cardBgClass,
                                radiusClass
                            )}
                        >
                            {/* Botón Cerrar */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "absolute top-3 right-3 sm:top-4 sm:right-4 z-10 backdrop-blur-md hover:bg-muted rounded-full h-9 w-9 sm:h-10 sm:w-10 text-foreground",
                                    "bg-[color:rgba(var(--store-surface-rgb),0.72)]"
                                )}
                                onClick={onClose}
                            >
                                <XCircle className="h-6 w-6" />
                            </Button>

                            {/* Lado Izquierdo: Imagen */}
                            <div className="w-full md:w-1/2 bg-muted/40 flex items-center justify-center p-4 sm:p-8 aspect-square md:aspect-auto relative">
                                {product.imagenUrl ? (
                                    <Image
                                        src={product.imagenUrl}
                                        alt={product.nombre}
                                        fill
                                        sizes="(max-width: 768px) 100vw, 50vw"
                                        className="object-contain mix-blend-multiply"
                                    />
                                ) : (
                                    <PackageOpen className="h-24 w-24 opacity-10" />
                                )}
                            </div>

                            {/* Lado Derecho: Detalles */}
                            <div className="w-full md:w-1/2 p-4 sm:p-8 flex flex-col overflow-y-auto">
                                <div>
                                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 mb-2 block">
                                        {product.categoria?.nombre || "Sin Categoría"}
                                    </span>
                                    <h2 className="text-xl sm:text-3xl font-black text-foreground leading-tight mb-4">
                                        {product.nombre}
                                    </h2>

                                    <div className="mb-6">
                                        {isAvailable ? (
                                            <Badge className="bg-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)] text-[color:var(--ui-fx-white)] border-transparent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> EN STOCK ({product.stockDisponibleUnits})
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive" className="bg-foreground text-[color:var(--ui-fx-white)] border-transparent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                AGOTADO
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 mb-8 pb-8 border-b border-border/70">
                                    {descuento ? (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-semibold text-muted-foreground/80 line-through">
                                                    ${descuento.precioOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <Badge variant="destructive" className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                                                    -{Math.abs(descuento.porcentaje)}% OFF
                                                </Badge>
                                            </div>
                                            <span className="text-3xl sm:text-4xl font-black text-destructive tracking-tight">
                                                ${descuento.precioFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-sm font-semibold text-[color:var(--status-success-strong)]">
                                                Ahorrás ${(descuento.precioOriginal - descuento.precioFinal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                                                ${displayedPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                            {isConsigne && (
                                                <span className="text-sm font-semibold text-muted-foreground/80 line-through">
                                                    Precio general: ${basePrice.toLocaleString('es-AR')}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>

                                {/* 👇 ACÁ ESTÁ LA MAGIA: Controles de Carrito protegidos por la configuración */}
                                {/* Botón WhatsApp */}
                                {config.whatsappNumber && (
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "h-14 px-6 border-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)] transition-all duration-300",
                                            buttonRadiusClass
                                        )}
                                        onClick={() => {
                                            const template = config.whatsappMessage || "Hola, estoy buscando {nombre_producto}";
                                            const message = template.replace("{nombre_producto}", product.nombre);
                                            const url = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
                                            window.open(url, '_blank');
                                        }}
                                    >
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                    </Button>
                                )}

                                {/* Botón Añadir */}
                                {config.convertirTienda && (
                                    <Button
                                        className={cn(
                                            "h-14 flex-1 text-base font-black shadow-xl transition-all duration-300",
                                            buttonRadiusClass,
                                            buttonHoverClass,
                                            "bg-foreground text-[color:var(--ui-fx-white)] hover:bg-foreground/90"
                                        )}
                                        disabled={!isAvailable}
                                        onClick={() => {
                                            onAddToCart(product, quantity);
                                            onClose(); // Cerrar modal al añadir
                                        }}
                                    >
                                        <ShoppingCart className="h-5 w-5 mr-3" />
                                        {isAvailable ? "AGREGAR AL CARRITO" : "SIN STOCK"}
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
