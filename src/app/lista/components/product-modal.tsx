"use client";

import { XCircle, ShoppingCart, PackageOpen, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { getThemeStyles } from "../lib/theme-utils";

interface ProductModalProps {
    product: any | null;
    isOpen: boolean;
    onClose: () => void;
    config: any;
    isConsigne: boolean;
    onAddToCart: (product: any, quantity: number) => void;
}

export function ProductModal({ product, isOpen, onClose, config, isConsigne, onAddToCart }: ProductModalProps) {
    const [quantity, setQuantity] = useState(1);

    // Resetear la cantidad cada vez que se abre un producto nuevo
    useEffect(() => {
        if (isOpen) setQuantity(1);
    }, [isOpen, product]);

    if (!product) return null;

    const { radiusClass, buttonRadiusClass, buttonHoverClass, cardBgClass } = getThemeStyles(config?.themeIdentifier);
    const basePrice = Number(product.precioVenta);
    const displayedPrice = isConsigne
        ? basePrice * (1 + (config.porcentajeAumentoConsignacion / 100))
        : basePrice;
    const isAvailable = product.stockDisponibleUnits > 0;

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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
                    >
                        {/* Contenedor del Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()} // Evita que el click cierre el modal
                            className={cn(
                                "w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative",
                                cardBgClass,
                                radiusClass
                            )}
                        >
                            {/* Botón Cerrar */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                    "absolute top-4 right-4 z-10 backdrop-blur-md hover:bg-neutral-200 rounded-full h-10 w-10 text-neutral-900",
                                    cardBgClass ? cardBgClass.split(" ")[0] + "/50" : "bg-white/50" // A bit hacky but works for bg-white -> bg-white/50
                                )}
                                onClick={onClose}
                            >
                                <XCircle className="h-6 w-6" />
                            </Button>

                            {/* Lado Izquierdo: Imagen */}
                            <div className="w-full md:w-1/2 bg-neutral-50 flex items-center justify-center p-8 aspect-square md:aspect-auto">
                                {product.imagenUrl ? (
                                    <img
                                        src={product.imagenUrl}
                                        alt={product.nombre}
                                        className="w-full h-full object-contain mix-blend-multiply"
                                    />
                                ) : (
                                    <PackageOpen className="h-24 w-24 opacity-10" />
                                )}
                            </div>

                            {/* Lado Derecho: Detalles */}
                            <div className="w-full md:w-1/2 p-6 sm:p-10 flex flex-col overflow-y-auto">
                                <div>
                                    <span className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-2 block">
                                        {product.categoria?.nombre || "Sin Categoría"}
                                    </span>
                                    <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 leading-tight mb-4">
                                        {product.nombre}
                                    </h2>

                                    <div className="mb-6">
                                        {isAvailable ? (
                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-transparent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> EN STOCK ({product.stockDisponibleUnits})
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive" className="bg-neutral-900 text-white border-transparent px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                AGOTADO
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 mb-8 pb-8 border-b border-neutral-100">
                                    <span className="text-4xl font-black text-neutral-900 tracking-tight">
                                        ${displayedPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                    {isConsigne && (
                                        <span className="text-sm font-semibold text-neutral-400 line-through">
                                            Precio general: ${basePrice.toLocaleString('es-AR')}
                                        </span>
                                    )}
                                </div>

                                {/* 👇 ACÁ ESTÁ LA MAGIA: Controles de Carrito protegidos por la configuración */}
                                {config.convertirTienda && (
                                    <div className="mt-auto flex flex-col sm:flex-row gap-4">
                                        {/* Selector de cantidad */}
                                        <div className={cn("flex items-center justify-between bg-neutral-100 px-4 h-14 w-full sm:w-1/3", buttonRadiusClass)}>
                                            <button
                                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                                className="text-2xl font-medium text-neutral-500 hover:text-neutral-900 transition-colors w-8"
                                            >
                                                -
                                            </button>
                                            <span className="font-black text-lg">{quantity}</span>
                                            <button
                                                onClick={() => setQuantity(quantity + 1)}
                                                disabled={quantity >= product.stockDisponibleUnits}
                                                className="text-2xl font-medium text-neutral-500 hover:text-neutral-900 disabled:opacity-30 transition-colors w-8"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Botón Añadir */}
                                        <Button
                                            className={cn(
                                                "h-14 flex-1 text-base font-black shadow-xl transition-all duration-300",
                                                buttonRadiusClass,
                                                buttonHoverClass,
                                                "bg-neutral-900 text-white hover:bg-neutral-800"
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
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}