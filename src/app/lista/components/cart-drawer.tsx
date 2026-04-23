"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  MessageCircle,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  XCircle,
  Package,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCatalogCartLineSubtotal, getCatalogCartSubtotal, getCatalogCartUnitPrice } from "@/lib/catalog-cart-pricing";
import type {
  CatalogCartItem,
  PublicCatalogConfig,
  PublicCheckoutCustomerData,
  PublicCheckoutShippingData,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";

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

const PRICING_CONTEXT = (config: PublicCatalogConfig) => ({
  porcentajeAumentoConsignacion: config.porcentajeAumentoConsignacion,
});

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  config,
  onUpdateQuantity,
  onRemove,
  onCheckout,
  loading,
}: CartDrawerProps) {
  const { theme, radiusClass, buttonRadiusClass, buttonHoverClass, cardBgClass, pageBgClass } = getThemeStyles(config.themeIdentifier);
  const [step, setStep] = React.useState(1);
  const [clienteData, setClienteData] = React.useState<PublicCheckoutCustomerData>({
    nombre: "",
    email: "",
    documento: "",
    telefono: "",
    provincia: "",
    localidad: "",
    codigoPostal: "",
    direccion: "",
    altura: "",
  });
  const [envioData, setEnvioData] = React.useState<PublicCheckoutShippingData>({
    metodoEnvio: null,
    costo: 0,
  });

  React.useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setEnvioData({ metodoEnvio: null, costo: 0 });
    }
  }, [isOpen]);

  const subtotalProductos = React.useMemo(
    () => getCatalogCartSubtotal(cart, PRICING_CONTEXT(config)),
    [cart, config],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClienteData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleContinue = () => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!clienteData.nombre.trim()) {
        toast.error("Por favor completá tu nombre.");
        return;
      }
      setStep(3);
      return;
    }

    if (!envioData.metodoEnvio) {
      toast.error("Seleccioná un metodo de entrega.");
      return;
    }

    if (envioData.metodoEnvio === "UBER_FLASH" || envioData.metodoEnvio === "ENCOMIENDA") {
      if (!clienteData.direccion?.trim() || !clienteData.altura?.trim() || !clienteData.localidad?.trim() || !clienteData.provincia?.trim()) {
        toast.error("Para este envio necesitamos domicilio, altura, localidad y provincia.");
        return;
      }
    }

    onCheckout(clienteData, envioData);
  };

  const canSendWhatsapp = Boolean(config.whatsappNumber?.trim());
  const requiresDeliveryAddress = envioData.metodoEnvio === "UBER_FLASH" || envioData.metodoEnvio === "ENCOMIENDA";
  const selectedDeliveryNeedsDisclaimer = envioData.metodoEnvio === "UBER_FLASH" || envioData.metodoEnvio === "ENCOMIENDA";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
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
              theme === "modern" || theme === "barbie" || theme === "ocean"
                ? "md:m-4 md:rounded-[2.5rem] md:h-[calc(100vh-2rem)]"
                : theme === "minimal" || theme === "luxury"
                  ? "md:border-l border-border"
                  : "md:m-4 md:rounded-2xl md:h-[calc(100vh-2rem)] shadow-2xl border",
            )}
          >
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
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Paso {step} de 3</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full hover:rotate-90 transition-transform duration-300" onClick={onClose}>
                <XCircle className="h-6 w-6 text-muted-foreground/80" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 custom-scrollbar">
              {step === 1 && (
                cart.length === 0 ? (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col items-center justify-center text-center p-10">
                    <div className="w-24 h-24 bg-muted/55 rounded-full flex items-center justify-center mb-6">
                      <ShoppingBag className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-xl font-bold text-foreground">Tu carrito esta vacio</p>
                    <p className="text-muted-foreground text-sm mt-2">Explorá la tienda y agregá los productos que quieras pedir por WhatsApp.</p>
                    <Button onClick={onClose} variant="outline" className={cn("mt-6 font-bold", buttonRadiusClass)}>VOLVER A LA TIENDA</Button>
                  </motion.div>
                ) : (
                  cart.map((item, index) => {
                    const unitPrice = getCatalogCartUnitPrice(item, PRICING_CONTEXT(config));
                    const lineSubtotal = getCatalogCartLineSubtotal(item, PRICING_CONTEXT(config));
                    const originalUnitPrice = item.descuentoEfectivo?.precioOriginal != null ? Number(item.descuentoEfectivo.precioOriginal) : null;
                    const hasDiscount = originalUnitPrice != null && originalUnitPrice > unitPrice;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "relative group border border-border/70 p-3 shadow-sm hover:shadow-md transition-all flex gap-4",
                          cardBgClass,
                          radiusClass,
                        )}
                      >
                        <div className={cn("h-24 w-24 bg-foreground/5 overflow-hidden shrink-0 border border-border/70 relative", radiusClass)}>
                          {item.imagenUrl ? (
                            <Image src={item.imagenUrl} alt={item.nombre} fill sizes="96px" className="object-cover group-hover:scale-110 transition-transform duration-500 mix-blend-multiply" />
                          ) : null}
                        </div>

                        <div className="flex-1 flex flex-col justify-between gap-3">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-foreground line-clamp-2 leading-tight">{item.nombre}</h4>
                              <p className="text-[11px] text-muted-foreground mt-1">Stock disponible: {item.stockDisponibleUnits}</p>
                            </div>
                            <button
                              onClick={() => onRemove(item.id)}
                              className={cn("p-1.5 text-muted-foreground hover:text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/10 transition-colors", buttonRadiusClass)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex items-end justify-between gap-3">
                            <div className={cn("flex items-center gap-3 bg-muted/30 p-1 border border-border/70", buttonRadiusClass)}>
                              <button
                                disabled={item.quantity <= 1}
                                onClick={() => onUpdateQuantity(item.id, -1)}
                                className={cn("h-8 w-8 flex items-center justify-center shadow-sm hover:bg-muted/55 disabled:opacity-30 transition-all font-bold text-muted-foreground", cardBgClass, buttonRadiusClass)}
                              >
                                -
                              </button>
                              <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                              <button
                                disabled={item.quantity >= item.stockDisponibleUnits}
                                onClick={() => onUpdateQuantity(item.id, 1)}
                                className={cn("h-8 w-8 flex items-center justify-center shadow-sm hover:bg-muted/55 disabled:opacity-30 transition-all font-bold text-muted-foreground", cardBgClass, buttonRadiusClass)}
                              >
                                +
                              </button>
                            </div>

                            <div className="text-right">
                              {hasDiscount ? (
                                <p className="text-xs text-muted-foreground line-through font-medium">
                                  ${originalUnitPrice?.toLocaleString("es-AR")} c/u
                                </p>
                              ) : null}
                              <p className="text-xs text-muted-foreground font-medium">
                                ${unitPrice.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} c/u
                              </p>
                              <p className="font-black text-lg text-foreground">
                                ${lineSubtotal.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )
              )}

              {step === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-foreground">Nombre completo *</Label>
                    <Input className="border-border/80 bg-background/90 text-foreground placeholder:text-muted-foreground" name="nombre" value={clienteData.nombre} onChange={handleInputChange} placeholder="Ej. Juan Perez" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-foreground">Telefono</Label>
                    <Input className="border-border/80 bg-background/90 text-foreground placeholder:text-muted-foreground" name="telefono" value={clienteData.telefono ?? ""} onChange={handleInputChange} placeholder="11 1234 5678" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-foreground">Email</Label>
                    <Input className="border-border/80 bg-background/90 text-foreground placeholder:text-muted-foreground" type="email" name="email" value={clienteData.email} onChange={handleInputChange} placeholder="Opcional" />
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-foreground/80">
                    Vamos a preparar un mensaje con tus productos para abrirlo directamente en WhatsApp.
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <h4 className="font-bold text-sm text-foreground mb-2">Seleccioná como querés recibir tu pedido</h4>

                  <div className="space-y-3">
                    <div
                      onClick={() => setEnvioData({ metodoEnvio: "RETIRO_LOCAL", costo: 0 })}
                      className={cn(
                        "p-4 border rounded-xl cursor-pointer flex items-center justify-between transition-all",
                        envioData.metodoEnvio === "RETIRO_LOCAL" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-border",
                      )}
                    >
                      <div className="flex gap-4 items-center">
                        <div className="bg-[color:var(--store-surface)] p-2 border border-border rounded-full shadow-sm">
                          <Store className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">Retiro por el local</p>
                          <p className="text-xs text-muted-foreground">Pasás a buscarlo por el local</p>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setEnvioData({ metodoEnvio: "UBER_FLASH", costo: 0 })}
                      className={cn(
                        "p-4 border rounded-xl cursor-pointer flex items-center justify-between transition-all",
                        envioData.metodoEnvio === "UBER_FLASH" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-border bg-background/70",
                      )}
                    >
                      <div className="flex gap-4 items-center">
                        <div className="bg-primary/12 p-2 border border-primary/25 rounded-full shadow-sm text-primary">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">Envio por Uber Flash</p>
                          <p className="text-xs text-muted-foreground">Coordinamos por WhatsApp y el envio se cobra aparte</p>
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => setEnvioData({ metodoEnvio: "ENCOMIENDA", costo: 0 })}
                      className={cn(
                        "p-4 border rounded-xl cursor-pointer flex items-center justify-between transition-all",
                        envioData.metodoEnvio === "ENCOMIENDA" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-border bg-background/70",
                      )}
                    >
                      <div className="flex gap-4 items-center">
                        <div className="bg-primary/12 p-2 border border-primary/25 rounded-full shadow-sm text-primary">
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground">Envio por encomienda</p>
                          <p className="text-xs text-muted-foreground">Se coordina por WhatsApp y el envio se cobra aparte</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedDeliveryNeedsDisclaimer ? (
                    <div className="rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-950">
                      El costo del envio no esta incluido en el total de productos. Te vamos a indicar por WhatsApp los pasos a seguir y el valor final del envio.
                    </div>
                  ) : null}

                  {requiresDeliveryAddress ? (
                    <div className="space-y-4 border-t border-border/70 pt-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-bold text-foreground">Domicilio *</Label>
                        <Input className="border-border/80 bg-background/90 text-foreground placeholder:text-muted-foreground" name="direccion" value={clienteData.direccion ?? ""} onChange={handleInputChange} placeholder="Ej. Av. Santa Fe" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-sm font-bold text-foreground">Altura *</Label>
                          <Input className="border-border/80 bg-background/90 text-foreground placeholder:text-muted-foreground" name="altura" value={clienteData.altura ?? ""} onChange={handleInputChange} placeholder="1234" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-bold text-foreground">Localidad *</Label>
                          <Input className="border-border/80 bg-background/90 text-foreground placeholder:text-muted-foreground" name="localidad" value={clienteData.localidad ?? ""} onChange={handleInputChange} placeholder="Ciudad" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm font-bold text-foreground">Provincia *</Label>
                        <Input className="border-border/80 bg-background/90 text-foreground placeholder:text-muted-foreground" name="provincia" value={clienteData.provincia ?? ""} onChange={handleInputChange} placeholder="Provincia" />
                      </div>
                    </div>
                  ) : null}

                  {!canSendWhatsapp ? (
                    <div className="rounded-xl border border-[color:var(--status-danger)]/30 bg-[color:var(--status-danger)]/10 p-4 text-sm text-foreground">
                      No hay un numero de WhatsApp configurado para esta tienda. Configuralo desde settings antes de usar este checkout.
                    </div>
                  ) : null}
                </motion.div>
              )}
            </div>

            {cart.length > 0 ? (
              <div className={cn("p-4 sm:p-8 border-t border-border/70 space-y-4", cardBgClass)}>
                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm text-muted-foreground font-medium">
                    <span>Productos</span>
                    <span className="text-foreground">${subtotalProductos.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="pt-4 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total estimado</p>
                      <p className="text-3xl font-black text-foreground tracking-tighter">
                        ${subtotalProductos.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  className={cn(
                    "w-full h-14 sm:h-16 text-sm sm:text-md font-black shadow-xl transition-all gap-3 overflow-hidden group relative bg-primary hover:bg-primary/90 text-primary-foreground",
                    buttonRadiusClass,
                    buttonHoverClass,
                  )}
                  onClick={handleContinue}
                  disabled={loading || !canSendWhatsapp}
                >
                  {loading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : step === 3 ? (
                    <>
                      <span className="relative z-10">ENVIAR PEDIDO POR WHATSAPP</span>
                      <MessageCircle className="h-5 w-5 relative z-10" />
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">CONTINUAR</span>
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform relative z-10" />
                    </>
                  )}
                </Button>
              </div>
            ) : null}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
