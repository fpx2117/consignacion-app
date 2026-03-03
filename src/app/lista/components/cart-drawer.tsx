/* eslint-disable */
// @ts-nocheck
"use client";

import { ShoppingCart, XCircle, Trash2, Info, ArrowRight, Loader2, ShieldCheck, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    cart: any[];
    config: any;
    onUpdateQuantity: (id: number, delta: number) => void;
    onRemove: (id: number) => void;
    onCheckout: () => void;
    loading: boolean;
}

export function CartDrawer({
    isOpen, onClose, cart, config, onUpdateQuantity, onRemove, onCheckout, loading
}: CartDrawerProps) {
    const { theme, radiusClass, buttonRadiusClass, buttonHoverClass, cardBgClass, pageBgClass } = getThemeStyles(config.themeIdentifier);
    const subtotal = cart.reduce((a, b) => a + (Number(b.precioVenta) * b.quantity), 0);
    const interest = config.convertirTienda ? (subtotal * (config.porcentajeInteresTarjeta / 100)) : 0;
    const total = subtotal + interest;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop con desenfoque más profundo */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[8px] z-[60]"
                    />

                    <motion.aside
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className={cn(
                            "fixed top-0 right-0 bottom-0 w-full max-w-lg backdrop-blur-xl z-[70] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] flex flex-col",
                            pageBgClass,
                            theme === 'modern' || theme === 'barbie' || theme === 'ocean' ? "md:m-4 md:rounded-[2.5rem] md:h-[calc(100vh-2rem)]" :
                                theme === 'minimal' || theme === 'luxury' ? "md:border-l border-zinc-200" :
                                    "md:m-4 md:rounded-2xl md:h-[calc(100vh-2rem)] shadow-2xl border"
                        )}
                    >
                        {/* Header Elegante */}
                        <div className="px-8 py-6 flex items-center justify-between border-b border-zinc-200/50">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                                    TU CARRITO <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-full text-xs">{cart.length}</span>
                                </h2>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Finaliza tu orden ahora</p>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full hover:rotate-90 transition-transform duration-300" onClick={onClose}>
                                <XCircle className="h-6 w-6 text-zinc-400" />
                            </Button>
                        </div>

                        {/* Lista de Productos */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                            {cart.length === 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="h-full flex flex-col items-center justify-center text-center p-10"
                                >
                                    <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
                                        <ShoppingBag className="h-10 w-10 text-zinc-300" />
                                    </div>
                                    <p className="text-xl font-bold text-zinc-800">¿Aún no te decides?</p>
                                    <p className="text-zinc-500 text-sm mt-2">Explora nuestros productos y llena tu carrito de estilo.</p>
                                    <Button onClick={onClose} variant="outline" className={cn("mt-6 font-bold", buttonRadiusClass)}>VOLVER A LA TIENDA</Button>
                                </motion.div>
                            ) : (
                                cart.map((item, index) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={cn(
                                            "relative group border border-zinc-100 p-3 shadow-sm hover:shadow-md transition-all flex gap-4",
                                            cardBgClass,
                                            radiusClass
                                        )}
                                    >
                                        {/* Imagen con Aspect Ratio controlado */}
                                        <div className={cn("h-24 w-24 bg-black/5 overflow-hidden shrink-0 border border-zinc-100", radiusClass)}>
                                            {item.imagenUrl && (
                                                <img src={item.imagenUrl} alt={item.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 mix-blend-multiply" />
                                            )}
                                        </div>

                                        <div className="flex-1 flex flex-col justify-between">
                                            <div className="flex justify-between items-start gap-2">
                                                <div>
                                                    <h4 className="font-bold text-sm text-zinc-800 line-clamp-2 leading-tight">{item.nombre}</h4>
                                                    <p className="text-[10px] font-medium text-primary mt-1">{item.categoria?.nombre}</p>
                                                </div>
                                                <button
                                                    onClick={() => onRemove(item.id)}
                                                    className={cn("p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors", buttonRadiusClass)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>

                                            <div className="flex items-end justify-between">
                                                {/* Selector de cantidad minimalista */}
                                                <div className={cn("flex items-center gap-3 bg-zinc-50/50 p-1 border border-zinc-100", buttonRadiusClass)}>
                                                    <button
                                                        disabled={item.quantity <= 1}
                                                        onClick={() => onUpdateQuantity(item.id, -1)}
                                                        className={cn("h-8 w-8 flex items-center justify-center shadow-sm hover:bg-zinc-100 disabled:opacity-30 transition-all font-bold text-zinc-600", cardBgClass, buttonRadiusClass)}
                                                    >
                                                        -
                                                    </button>
                                                    <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                                    <button
                                                        onClick={() => onUpdateQuantity(item.id, 1)}
                                                        className={cn("h-8 w-8 flex items-center justify-center shadow-sm hover:bg-zinc-100 transition-all font-bold text-zinc-600", cardBgClass, buttonRadiusClass)}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-zinc-400 line-through font-medium">
                                                        ${(Number(item.precioVenta)).toLocaleString('es-AR')} c/u
                                                    </p>
                                                    <p className="font-black text-lg text-zinc-900">
                                                        ${(Number(item.precioVenta) * item.quantity).toLocaleString('es-AR')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* Footer / Resumen de Compra */}
                        {cart.length > 0 && (
                            <div className={cn("p-8 border-t border-zinc-100 space-y-4", cardBgClass)}>
                                <div className="space-y-2.5">
                                    <div className="flex justify-between text-sm text-zinc-500 font-medium">
                                        <span>Subtotal</span>
                                        <span className="text-zinc-900">${subtotal.toLocaleString('es-AR')}</span>
                                    </div>
                                    {config.convertirTienda && (
                                        <div className="flex justify-between text-sm text-zinc-400">
                                            <span className="flex items-center gap-1.5">Cargo tarjeta ({config.porcentajeInteresTarjeta}%) <Info className="h-3 w-3" /></span>
                                            <span className="text-zinc-600">+${interest.toLocaleString('es-AR')}</span>
                                        </div>
                                    )}
                                    <div className="pt-4 flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Estimado</p>
                                            <p className="text-3xl font-black text-zinc-900 tracking-tighter">
                                                ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                        <div className="text-right pb-1">
                                            <span className={cn("text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 font-bold", buttonRadiusClass)}>IVA INCLUIDO</span>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    className={cn(
                                        "w-full h-16 text-md font-black shadow-xl transition-all gap-3 overflow-hidden group relative bg-zinc-900 hover:bg-zinc-800 text-white",
                                        buttonRadiusClass,
                                        buttonHoverClass
                                    )}
                                    onClick={onCheckout}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                                        <>
                                            <span className="relative z-10">CONFIRMAR COMPRA</span>
                                            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform relative z-10" />
                                        </>
                                    )}
                                </Button>

                                {/* Footer Security */}
                                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2">
                                    <div className="flex items-center gap-1.5 text-zinc-400">
                                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                        <span className="text-[9px] uppercase font-bold tracking-wider">Checkout Seguro</span>
                                    </div>
                                    <div className="h-3 w-[1px] bg-zinc-200 hidden sm:block" />
                                    <img
                                        src="https://logodownload.org/wp-content/uploads/2019/06/mercado-pago-logo-0.png"
                                        alt="Mercado Pago"
                                        className="h-3.5 grayscale opacity-60 contrast-125"
                                    />
                                </div>
                            </div>
                        )}
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}