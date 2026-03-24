"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { XCircle, Trash2, Info, ArrowRight, Loader2, ShieldCheck, ShoppingBag, ArrowLeft, Truck, Store } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import type {
    CatalogCartItem,
    PublicCatalogConfig,
    PublicCheckoutCustomerData,
    PublicCheckoutShippingData,
    PublicShippingQuote,
} from "@/lib/types";

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    cart: CatalogCartItem[];
    config: PublicCatalogConfig;
    onUpdateQuantity: (id: number, delta: number) => void;
    onRemove: (id: number) => void;
    onCheckout: (clienteData: PublicCheckoutCustomerData, envioData: PublicCheckoutShippingData) => void;
    loading: boolean;
}

export function CartDrawer({
    isOpen, onClose, cart, config, onUpdateQuantity, onRemove, onCheckout, loading
}: CartDrawerProps) {
    const { theme, radiusClass, buttonRadiusClass, buttonHoverClass, cardBgClass, pageBgClass } = getThemeStyles(config.themeIdentifier);

    // Pasos del Wizard: 1 = Carrito, 2 = Datos CLI, 3 = Envío, 4 = Resumen y Pago
    const [step, setStep] = useState(1);

    // Estado del Formulario
    const [clienteData, setClienteData] = useState<PublicCheckoutCustomerData>({
        nombre: "",
        email: "",
        documento: "",
        telefono: "",
        provincia: "",
        localidad: "",
        codigoPostal: "",
        direccion: "",
    });

    const [envioData, setEnvioData] = useState<{
        metodoEnvio: "DOMICILIO" | "SUCURSAL" | "RETIRO_LOCAL" | null;
        costo: number;
    }>({
        metodoEnvio: null,
        costo: 0,
    });

    const [tarifas, setTarifas] = useState<PublicShippingQuote | null>(null);
    const [cotizando, setCotizando] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setClienteData({ ...clienteData, [e.target.name]: e.target.value });
    };

    // Resets al cerrar o al abrir
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setTarifas(null);
            setEnvioData({ metodoEnvio: null, costo: 0 });
        }
    }, [isOpen]);

    const subtotalProductos = cart.reduce((a, b) => {
        const precioUnitario = b.descuentoEfectivo?.precioFinal ?? Number(b.precioVenta);
        return a + (precioUnitario * b.quantity);
    }, 0);
    const interest = config.convertirTienda ? (subtotalProductos * ((config.porcentajeInteresTarjeta ?? 0) / 100)) : 0;
    const totalParcial = subtotalProductos + interest;
    const totalFinal = totalParcial + (envioData.costo || 0);

    const handleSiguiente = async () => {
        if (step === 1) {
            setStep(2);
        } else if (step === 2) {
            if (!clienteData.nombre || !clienteData.email || !clienteData.codigoPostal || !clienteData.direccion) {
                toast.error("Por favor completa Nombre, Email, Dirección y Código Postal.");
                return;
            }
            // Cotizar envío automatically before going to step 3
            await cotizarEnvios();
            setStep(3);
        } else if (step === 3) {
            if (!envioData.metodoEnvio) {
                toast.error("Por favor selecciona un método de entrega.");
                return;
            }
            // Realizar Checkout final
            onCheckout(clienteData, envioData);
        }
    };

    const cotizarEnvios = async () => {
        setCotizando(true);
        try {
            const res = await apiService.cotizarEnvioPublico({
                sucursalId: config.sucursalId,
                codigoPostal: clienteData.codigoPostal ?? "",
                subtotal: totalParcial,
            });
            setTarifas(res);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Error al cotizar envío. Revisa tu CP.";
            toast.error(message);
        } finally {
            setCotizando(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/42 backdrop-blur-[3px] z-[60]"
                    />

                    <motion.aside
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className={cn(
                            "fixed top-0 right-0 bottom-0 w-full max-w-lg backdrop-blur-xl z-[70] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] flex flex-col",
                            pageBgClass,
                            (theme === 'modern' || theme === 'barbie' || theme === 'ocean') ? "md:m-4 md:rounded-[2.5rem] md:h-[calc(100vh-2rem)]" :
                                (theme === 'minimal' || theme === 'luxury') ? "md:border-l border-border" :
                                    "md:m-4 md:rounded-2xl md:h-[calc(100vh-2rem)] shadow-2xl border"
                        )}
                    >
                        {/* Header */}
                        <div className="px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between border-b border-border/50 gap-2">
                            <div className="flex items-center gap-3">
                                {step > 1 && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setStep(step - 1)}>
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                )}
                                <div className="flex flex-col">
                                    <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2 text-foreground">
                                        {step === 1 ? "TU CARRITO" : step === 2 ? "TUS DATOS" : "ENTREGA"}
                                        {step === 1 && <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-full text-xs">{cart.length}</span>}
                                    </h2>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                        Paso {step} de 3
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full hover:rotate-90 transition-transform duration-300" onClick={onClose}>
                                <XCircle className="h-6 w-6 text-muted-foreground/80" />
                            </Button>
                        </div>

                        {/* Contenido principal según paso */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 custom-scrollbar">

                            {/* PASO 1: PRODUCTOS */}
                            {step === 1 && (
                                cart.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="h-full flex flex-col items-center justify-center text-center p-10"
                                    >
                                        <div className="w-24 h-24 bg-muted/55 rounded-full flex items-center justify-center mb-6">
                                            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
                                        </div>
                                        <p className="text-xl font-bold text-foreground">¿Aún no te decides?</p>
                                        <p className="text-muted-foreground text-sm mt-2">Explora nuestros productos y llena tu carrito de estilo.</p>
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
                                                "relative group border border-border/70 p-3 shadow-sm hover:shadow-md transition-all flex gap-4",
                                                cardBgClass,
                                                radiusClass
                                            )}
                                        >
                                            <div className={cn("h-24 w-24 bg-foreground/5 overflow-hidden shrink-0 border border-border/70 relative", radiusClass)}>
                                                {item.imagenUrl && (
                                                    <Image src={item.imagenUrl} alt={item.nombre} fill sizes="96px" className="object-cover group-hover:scale-110 transition-transform duration-500 mix-blend-multiply" />
                                                )}
                                            </div>

                                            <div className="flex-1 flex flex-col justify-between">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div>
                                                        <h4 className="font-bold text-sm text-foreground line-clamp-2 leading-tight">{item.nombre}</h4>
                                                    </div>
                                                    <button
                                                        onClick={() => onRemove(item.id)}
                                                        className={cn("p-1.5 text-muted-foreground hover:text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] transition-colors", buttonRadiusClass)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>

                                                <div className="flex items-end justify-between">
                                                    <div className={cn("flex items-center gap-3 bg-muted/30 p-1 border border-border/70", buttonRadiusClass)}>
                                                        <button disabled={item.quantity <= 1} onClick={() => onUpdateQuantity(item.id, -1)} className={cn("h-8 w-8 flex items-center justify-center shadow-sm hover:bg-muted/55 disabled:opacity-30 transition-all font-bold text-muted-foreground", cardBgClass, buttonRadiusClass)}>-</button>
                                                        <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                                        <button onClick={() => onUpdateQuantity(item.id, 1)} className={cn("h-8 w-8 flex items-center justify-center shadow-sm hover:bg-muted/55 transition-all font-bold text-muted-foreground", cardBgClass, buttonRadiusClass)}>+</button>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-muted-foreground line-through font-medium">
                                                            ${(Number(item.precioVenta)).toLocaleString('es-AR')} c/u
                                                        </p>
                                                        <p className="font-black text-lg text-foreground">
                                                            ${(Number(item.precioVenta) * item.quantity).toLocaleString('es-AR')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )
                            )}

                            {/* PASO 2: DATOS DEL CLIENTE */}
                            {step === 2 && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>Nombre Completo *</Label>
                                            <Input name="nombre" value={clienteData.nombre} onChange={handleInputChange} placeholder="Ej. Juan Pérez" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>DNI / CUIT</Label>
                                            <Input name="documento" value={clienteData.documento ?? ""} onChange={handleInputChange} placeholder="Sin puntos" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Email *</Label>
                                        <Input type="email" name="email" value={clienteData.email} onChange={handleInputChange} placeholder="juan@ejemplo.com" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Teléfono</Label>
                                            <Input name="telefono" value={clienteData.telefono ?? ""} onChange={handleInputChange} placeholder="11 1234 5678" />
                                    </div>

                                    <div className="pt-2 border-t border-border/70">
                                        <h4 className="font-bold text-sm text-foreground mb-2">Dirección de Entrega</h4>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Provincia</Label>
                                        <Input name="provincia" value={clienteData.provincia ?? ""} onChange={handleInputChange} placeholder="Ej. Buenos Aires" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label>Localidad</Label>
                                            <Input name="localidad" value={clienteData.localidad ?? ""} onChange={handleInputChange} placeholder="Ej. CABA" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label>Código Postal *</Label>
                                            <Input name="codigoPostal" value={clienteData.codigoPostal ?? ""} onChange={handleInputChange} placeholder="1000" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Calle y Número *</Label>
                                        <Input name="direccion" value={clienteData.direccion ?? ""} onChange={handleInputChange} placeholder="Av. Siempre Viva 123, Piso 1" />
                                    </div>
                                </motion.div>
                            )}

                            {/* PASO 3: ENVÍO */}
                            {step === 3 && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                    <h4 className="font-bold text-sm text-foreground mb-2">Selecciona un método de entrega</h4>

                                    {cotizando ? (
                                        <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-xl">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                            <p className="text-sm text-muted-foreground">Cotizando con Andreani...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {/* Retiro en Local */}
                                            <div
                                                onClick={() => setEnvioData({ metodoEnvio: "RETIRO_LOCAL", costo: 0 })}
                                                className={cn(
                                                    "p-4 border rounded-xl cursor-pointer flex items-center justify-between transition-all",
                                                    envioData.metodoEnvio === "RETIRO_LOCAL" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-border"
                                                )}>
                                                <div className="flex gap-4 items-center">
                                                    <div className="bg-[color:var(--store-surface)] p-2 border border-border rounded-full shadow-sm">
                                                        <Store className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-foreground">Retiro en Local</p>
                                                        <p className="text-xs text-muted-foreground">Pasas a buscarlo gratis</p>
                                                    </div>
                                                </div>
                                                <div className="font-black text-[color:var(--status-success-strong)]">Gratis</div>
                                            </div>

                                            {/* Andreani Domicilio */}
                                            {tarifas && tarifas.domicilio > 0 && (
                                                <div
                                                    onClick={() => setEnvioData({ metodoEnvio: "DOMICILIO", costo: tarifas.domicilio })}
                                                    className={cn(
                                                        "p-4 border rounded-xl cursor-pointer flex items-center justify-between transition-all",
                                                        envioData.metodoEnvio === "DOMICILIO" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-border"
                                                    )}>
                                                    <div className="flex gap-4 items-center">
                                                        <div className="bg-[color:var(--theme-ocean-primary)]/80 p-2 border border-[color:var(--theme-ocean-primary)] rounded-full shadow-sm text-[color:var(--theme-ocean-primary)]">
                                                            <Truck className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-foreground">Envío a Domicilio</p>
                                                            <p className="text-xs text-muted-foreground">Andreani Clásico</p>
                                                        </div>
                                                    </div>
                                                    <div className="font-black text-foreground">${tarifas.domicilio.toLocaleString('es-AR')}</div>
                                                </div>
                                            )}

                                            {/* Andreani Sucursal */}
                                            {tarifas && tarifas.sucursal > 0 && (
                                                <div
                                                    onClick={() => setEnvioData({ metodoEnvio: "SUCURSAL", costo: tarifas.sucursal })}
                                                    className={cn(
                                                        "p-4 border rounded-xl cursor-pointer flex items-center justify-between transition-all",
                                                        envioData.metodoEnvio === "SUCURSAL" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-border"
                                                    )}>
                                                    <div className="flex gap-4 items-center">
                                                        <div className="bg-[color:var(--theme-ocean-primary)]/80 p-2 border border-[color:var(--theme-ocean-primary)] rounded-full shadow-sm text-[color:var(--theme-ocean-primary)]">
                                                            <Store className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-foreground">Retiro en Suc. Andreani</p>
                                                            <p className="text-xs text-muted-foreground">Más económico</p>
                                                        </div>
                                                    </div>
                                                    <div className="font-black text-foreground">${tarifas.sucursal.toLocaleString('es-AR')}</div>
                                                </div>
                                            )}

                                            {!tarifas && (
                                                <Button variant="outline" className="w-full mt-4" onClick={cotizarEnvios}>
                                                    Reintentar Cotización
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                        </div>

                        {/* Footer / Resumen de Compra */}
                        {cart.length > 0 && (
                            <div className={cn("p-4 sm:p-8 border-t border-border/70 space-y-4", cardBgClass)}>
                                <div className="space-y-2.5">
                                    <div className="flex justify-between text-sm text-muted-foreground font-medium">
                                        <span>Productos</span>
                                        <span className="text-foreground">${subtotalProductos.toLocaleString('es-AR')}</span>
                                    </div>
                                    {config.convertirTienda && interest > 0 && (
                                        <div className="flex justify-between text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1.5">Cargo tarjeta ({config.porcentajeInteresTarjeta}%) <Info className="h-3 w-3" /></span>
                                            <span className="text-muted-foreground">+${interest.toLocaleString('es-AR')}</span>
                                        </div>
                                    )}
                                    {envioData.costo > 0 && (
                                        <div className="flex justify-between text-sm text-[color:var(--theme-ocean-primary)]">
                                            <span>Envío</span>
                                            <span>+${envioData.costo.toLocaleString('es-AR')}</span>
                                        </div>
                                    )}
                                    <div className="pt-4 flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Estimado</p>
                                            <p className="text-3xl font-black text-foreground tracking-tighter">
                                                ${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    className={cn(
                                        "w-full h-14 sm:h-16 text-sm sm:text-md font-black shadow-xl transition-all gap-3 overflow-hidden group relative bg-primary hover:bg-primary/90 text-primary-foreground",
                                        buttonRadiusClass,
                                        buttonHoverClass
                                    )}
                                    onClick={handleSiguiente}
                                    disabled={loading || cotizando}
                                >
                                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                                        <>
                                            <span className="relative z-10">{step === 3 ? "PAGAR EN MERCADOPAGO" : "CONTINUAR"}</span>
                                            {step < 3 && <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform relative z-10" />}
                                            {step === 3 && <ShieldCheck className="h-5 w-5 relative z-10" />}
                                        </>
                                    )}
                                </Button>

                                {/* Footer Security */}
                                {step === 3 && (
                                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            <ShieldCheck className="h-4 w-4 text-[color:var(--status-success-strong)]" />
                                            <span className="text-[9px] uppercase font-bold tracking-wider">Checkout Seguro</span>
                                        </div>
                                        <div className="h-3 w-[1px] bg-border hidden sm:block" />
                                        {/* Logo MercadoPago inline — sin dependencia externa */}
                                        <span className="text-[9px] font-bold tracking-tight opacity-60 grayscale">
                                            MercadoPago
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
