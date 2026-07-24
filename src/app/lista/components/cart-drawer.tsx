"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Receipt,
  ShoppingBag,
  Store,
  Truck,
  X,
  Package,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCatalogCartSubtotal } from "@/lib/storefront/catalog-cart-pricing";
import type {
  CatalogCartItem,
  PublicCatalogConfig,
  PublicCheckoutCustomerData,
  PublicCheckoutShippingData,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { OrderItem } from "./order-item";
import { OrderSummary } from "./order-summary";
import { CheckoutTicketPreview } from "./checkout-ticket-preview";
import { WhatsAppPreview } from "./whatsapp-preview";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CatalogCartItem[];
  config: PublicCatalogConfig;
  onUpdateQuantity: (id: number, delta: number) => void;
  onRemove: (id: number) => void;
  onCheckout: (
    clienteData: PublicCheckoutCustomerData,
    envioData: PublicCheckoutShippingData,
  ) => void;
  loading: boolean;
}

const PRICING_CONTEXT = (config: PublicCatalogConfig) => ({
  porcentajeAumentoConsignacion: config.porcentajeAumentoConsignacion,
  porcentajeInteresTarjeta: config.porcentajeInteresTarjeta,
  applyCardInterest: config.tiendaPaymentMode === "mercadopago",
});

const WHATSAPP_ICON_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

type DisplayMode = "bottom-sheet" | "modal" | "drawer";

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
  const [step, setStep] = React.useState(1);
  const [showTicketPreview, setShowTicketPreview] = React.useState(true);
  const [clienteData, setClienteData] =
    React.useState<PublicCheckoutCustomerData>({
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

  const ols = config.onlineStoreConfig;
  const displayMode: DisplayMode = ols?.cart?.displayMode ?? "bottom-sheet";
  const isWhatsappMode = config.tiendaPaymentMode === "whatsapp";
  const isMpMode = config.tiendaPaymentMode === "mercadopago";
  const showTicketPreviewSetting = ols?.cart?.showWhatsappPreview ?? true;
  const checkoutButtonText = isWhatsappMode
    ? ols?.cart?.whatsappButtonText?.trim() || "Enviar pedido por WhatsApp"
    : "Ir al pago";
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setEnvioData({ metodoEnvio: null, costo: 0 });
    }
  }, [isOpen]);

  // Bloquear scroll del body cuando el drawer está abierto
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const effectiveMode: DisplayMode = isMobile ? "bottom-sheet" : displayMode;
  const isBottomSheet = effectiveMode === "bottom-sheet";
  const isModal = effectiveMode === "modal";

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
      if (isMpMode && !clienteData.email.trim()) {
        toast.error("Necesitamos tu email para generar el checkout.");
        return;
      }
      setStep(3);
      return;
    }
    if (!envioData.metodoEnvio) {
      toast.error("Seleccioná un método de entrega.");
      return;
    }
    if (
      envioData.metodoEnvio === "UBER_FLASH" ||
      envioData.metodoEnvio === "ENCOMIENDA"
    ) {
      if (
        !clienteData.direccion?.trim() ||
        !clienteData.altura?.trim() ||
        !clienteData.localidad?.trim() ||
        !clienteData.provincia?.trim()
      ) {
        toast.error(
          "Para este envío necesitamos domicilio, altura, localidad y provincia.",
        );
        return;
      }
    }
    onCheckout(clienteData, envioData);
  };

  const requiresDeliveryAddress =
    envioData.metodoEnvio === "UBER_FLASH" ||
    envioData.metodoEnvio === "ENCOMIENDA";
  const selectedDeliveryNeedsDisclaimer =
    envioData.metodoEnvio === "UBER_FLASH" ||
    envioData.metodoEnvio === "ENCOMIENDA";

  // Animaciones según modo
  const panelAnim = isBottomSheet
    ? {
        initial: { y: "100%" as const },
        animate: { y: 0 },
        exit: { y: "100%" as const },
        transition: { type: "spring" as const, damping: 30, stiffness: 300 },
      }
    : isModal
      ? {
          initial: { scale: 0.95, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.95, opacity: 0 },
          transition: { type: "spring" as const, damping: 25, stiffness: 200 },
        }
      : {
          initial: { x: "100%" as const },
          animate: { x: 0 },
          exit: { x: "100%" as const },
          transition: { type: "spring" as const, damping: 28, stiffness: 250 },
        };

  const panelClass = isBottomSheet
    ? cn(
        "fixed bottom-0 left-0 right-0 z-[70] flex flex-col",
        "max-h-[92vh] rounded-t-[28px]",
        "shadow-[0_-8px_40px_rgba(0,0,0,0.15)]",
        "bg-[var(--store-surface,#FFFFFF)]",
        "sm:max-w-[430px] sm:mx-auto sm:left-0 sm:right-0",
      )
    : isModal
      ? cn(
          "fixed inset-0 m-auto w-full max-w-md h-[90vh] z-[70] flex flex-col",
          "rounded-[28px] shadow-2xl overflow-hidden",
          "bg-[var(--store-surface,#FFFFFF)]",
          "border border-gray-100",
        )
      : cn(
          "fixed top-0 right-0 bottom-0 w-full max-w-md z-[70] flex flex-col",
          "bg-[var(--store-surface,#FFFFFF)]",
          "md:m-3 md:rounded-[24px] md:h-[calc(100vh-24px)] shadow-[-16px_0_50px_rgba(0,0,0,0.08)]",
        );

  const stepLabels = ["Tu pedido", "Tus datos", "Entrega"];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
          />

          {/* Panel */}
          <motion.aside {...panelAnim} className={panelClass}>
            {/* Barra de deslizamiento (solo bottom sheet) */}
            {isBottomSheet && (
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
            )}

            {/* ── Header del drawer ── */}
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-black text-[var(--store-text,#0F172A)] leading-tight">
                    {stepLabels[step - 1]}
                  </h2>
                  {step === 1 && cart.length > 0 && (
                    <p className="text-sm text-[var(--store-muted,#8A8F98)]">
                      {cart.length}{" "}
                      {cart.length === 1 ? "producto" : "productos"}
                    </p>
                  )}
                  {step > 1 && (
                    <p className="text-xs text-[var(--store-muted,#8A8F98)] font-medium uppercase tracking-wide">
                      Paso {step} de 3
                    </p>
                  )}
                </div>
              </div>

              {/* Botón cerrar circular */}
              <button
                onClick={onClose}
                className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all hover:rotate-90 duration-300"
                aria-label="Cerrar carrito"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Separador */}
            <div className="h-px bg-gray-100 mx-5 flex-shrink-0" />

            {/* ── Contenido scrollable ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* PASO 1: Resumen del pedido */}
              {step === 1 &&
                (cart.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center p-10 min-h-[300px]"
                  >
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-5">
                      <ShoppingBag className="h-9 w-9 text-gray-300" />
                    </div>
                    <p className="text-lg font-bold text-[var(--store-text,#0F172A)]">
                      Tu carrito está vacío
                    </p>
                    <p className="text-sm text-[var(--store-muted,#8A8F98)] mt-2 max-w-[220px]">
                      Explorá el catálogo y agregá los productos que quieras
                      pedir.
                    </p>
                    <button
                      onClick={onClose}
                      className="mt-6 px-6 py-2.5 rounded-full text-white text-sm font-bold transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: "var(--store-primary,#007AFF)",
                      }}
                    >
                      Ver catálogo
                    </button>
                  </motion.div>
                ) : (
                  <div className="px-5 py-4 space-y-1">
                    {/* Lista de productos */}
                    <div className="divide-y divide-gray-100">
                      {cart.map((item) => (
                        <OrderItem
                          key={item.id}
                          item={item}
                          onUpdateQuantity={(id, qty) => {
                            const existing = cart.find((i) => i.id === id);
                            if (existing) {
                              const delta = qty - existing.quantity;
                              onUpdateQuantity(id, delta);
                            }
                          }}
                          onRemove={onRemove}
                          showImage={ols?.catalog?.showProductImages ?? true}
                        />
                      ))}
                    </div>

                    {/* Separador */}
                    <div className="h-px bg-gray-100 my-3" />

                    {/* Toggle de vista previa (ticket para Mercado Pago, mensaje para WhatsApp) */}
                    {showTicketPreviewSetting && ols && (
                      <div>
                        <button
                          onClick={() =>
                            setShowTicketPreview(!showTicketPreview)
                          }
                          className="text-xs text-[var(--store-muted,#8A8F98)] flex items-center gap-1.5 hover:text-[var(--store-text,#0F172A)] transition-colors w-full justify-center py-2"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          {showTicketPreview ? "Ocultar" : "Mostrar"}{" "}
                          {isWhatsappMode
                            ? "mensaje de WhatsApp"
                            : "vista previa del ticket"}
                        </button>

                        <AnimatePresence>
                          {showTicketPreview && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              {isWhatsappMode ? (
                                <WhatsAppPreview
                                  settings={ols}
                                  cartItems={cart}
                                  subtotal={`$${subtotalProductos.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                                  total={`$${subtotalProductos.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                                  porcentajeAumentoConsignacion={
                                    config.porcentajeAumentoConsignacion
                                  }
                                  className="mt-2"
                                />
                              ) : (
                                <CheckoutTicketPreview
                                  settings={ols}
                                  cartItems={cart}
                                  subtotal={`$${subtotalProductos.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                                  total={`$${subtotalProductos.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                                  porcentajeAumentoConsignacion={
                                    config.porcentajeAumentoConsignacion
                                  }
                                  porcentajeInteresTarjeta={
                                    config.porcentajeInteresTarjeta
                                  }
                                  className="mt-2"
                                />
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                ))}

              {/* PASO 2: Datos del cliente */}
              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="px-5 py-4 space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-[var(--store-text,#0F172A)]">
                      Nombre completo *
                    </Label>
                    <Input
                      name="nombre"
                      value={clienteData.nombre}
                      onChange={handleInputChange}
                      placeholder="Ej. Juan Pérez"
                      className="h-12 rounded-xl border-gray-200 bg-gray-50 text-[var(--store-text,#0F172A)] placeholder:text-gray-400 focus-visible:ring-[var(--store-primary,#007AFF)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-[var(--store-text,#0F172A)]">
                      Teléfono
                    </Label>
                    <Input
                      name="telefono"
                      value={clienteData.telefono ?? ""}
                      onChange={handleInputChange}
                      placeholder="11 1234-5678"
                      className="h-12 rounded-xl border-gray-200 bg-gray-50 text-[var(--store-text,#0F172A)] placeholder:text-gray-400 focus-visible:ring-[var(--store-primary,#007AFF)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-[var(--store-text,#0F172A)]">
                      Email{isMpMode ? " *" : ""}
                    </Label>
                    <Input
                      type="email"
                      name="email"
                      value={clienteData.email}
                      onChange={handleInputChange}
                      placeholder={isMpMode ? "nombre@correo.com" : "Opcional"}
                      className="h-12 rounded-xl border-gray-200 bg-gray-50 text-[var(--store-text,#0F172A)] placeholder:text-gray-400 focus-visible:ring-[var(--store-primary,#007AFF)]"
                    />
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl border p-4 text-sm",
                      isWhatsappMode
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                        : "bg-blue-50 border-blue-100 text-blue-700",
                    )}
                  >
                    {isWhatsappMode
                      ? "Vamos a preparar un mensaje con tu pedido para enviarlo directamente por WhatsApp."
                      : "Vamos a generar un checkout online con el detalle de tu pedido y un ticket digital como referencia."}
                  </div>
                </motion.div>
              )}

              {/* PASO 3: Método de entrega */}
              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="px-5 py-4 space-y-3"
                >
                  <h4 className="font-bold text-sm text-[var(--store-text,#0F172A)]">
                    ¿Cómo querés recibir tu pedido?
                  </h4>

                  {[
                    {
                      id: "RETIRO_LOCAL",
                      icon: Store,
                      title: "Retiro por el local",
                      desc: "Pasás a buscarlo por el local",
                      color: "bg-gray-100",
                      textColor: "text-gray-600",
                    },
                    {
                      id: "UBER_FLASH",
                      icon: Truck,
                      title: "Envío por Uber Flash",
                      desc: "El envío se coordina después del pago y se cobra aparte",
                      color: "bg-blue-50",
                      textColor: "text-blue-600",
                    },
                    {
                      id: "ENCOMIENDA",
                      icon: Package,
                      title: "Envío por encomienda",
                      desc: "La encomienda se coordina después del pago y se cobra aparte",
                      color: "bg-purple-50",
                      textColor: "text-purple-600",
                    },
                  ].map((option) => (
                    <div
                      key={option.id}
                      onClick={() =>
                        setEnvioData({
                          metodoEnvio: option.id as
                            "RETIRO_LOCAL" | "UBER_FLASH" | "ENCOMIENDA",
                          costo: 0,
                        })
                      }
                      className={cn(
                        "p-4 border-2 rounded-2xl cursor-pointer flex items-center gap-4 transition-all",
                        envioData.metodoEnvio === option.id
                          ? "border-[var(--store-primary,#007AFF)] bg-[var(--store-primary,#007AFF)]/5"
                          : "border-gray-100 hover:border-gray-200 bg-white",
                      )}
                    >
                      <div
                        className={`${option.color} p-2.5 rounded-xl flex-shrink-0`}
                      >
                        <option.icon
                          className={`h-5 w-5 ${option.textColor}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-[var(--store-text,#0F172A)]">
                          {option.title}
                        </p>
                        <p className="text-xs text-[var(--store-muted,#8A8F98)] mt-0.5">
                          {option.desc}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full border-2 flex-shrink-0 transition-all",
                          envioData.metodoEnvio === option.id
                            ? "border-[var(--store-primary,#007AFF)]"
                            : "border-gray-300",
                        )}
                      >
                        {envioData.metodoEnvio === option.id && (
                          <div
                            className="h-full w-full rounded-full scale-[0.55]"
                            style={{
                              backgroundColor: "var(--store-primary,#007AFF)",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  {selectedDeliveryNeedsDisclaimer && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      El costo del envío no está incluido en el total. Te
                      informaremos el valor por WhatsApp.
                    </div>
                  )}

                  {requiresDeliveryAddress && (
                    <div className="space-y-3 pt-2">
                      <div className="h-px bg-gray-100" />
                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold text-[var(--store-text,#0F172A)]">
                          Domicilio *
                        </Label>
                        <Input
                          name="direccion"
                          value={clienteData.direccion ?? ""}
                          onChange={handleInputChange}
                          placeholder="Ej. Av. Santa Fe"
                          className="h-12 rounded-xl border-gray-200 bg-gray-50"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold text-[var(--store-text,#0F172A)]">
                            Altura *
                          </Label>
                          <Input
                            name="altura"
                            value={clienteData.altura ?? ""}
                            onChange={handleInputChange}
                            placeholder="1234"
                            className="h-12 rounded-xl border-gray-200 bg-gray-50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold text-[var(--store-text,#0F172A)]">
                            Localidad *
                          </Label>
                          <Input
                            name="localidad"
                            value={clienteData.localidad ?? ""}
                            onChange={handleInputChange}
                            placeholder="Ciudad"
                            className="h-12 rounded-xl border-gray-200 bg-gray-50"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-semibold text-[var(--store-text,#0F172A)]">
                          Provincia *
                        </Label>
                        <Input
                          name="provincia"
                          value={clienteData.provincia ?? ""}
                          onChange={handleInputChange}
                          placeholder="Provincia"
                          className="h-12 rounded-xl border-gray-200 bg-gray-50"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* ── Footer con resumen + botón ── */}
            {cart.length > 0 && (
              <div className="flex-shrink-0 border-t border-gray-100 bg-[var(--store-surface,#FFFFFF)] px-5 py-4 space-y-3">
                {/* Resumen de precios en paso 1 */}
                {step === 1 && ols && (
                  <OrderSummary
                    subtotal={subtotalProductos}
                    settings={ols}
                    cartItems={cart}
                  />
                )}

                {/* Botón principal */}
                <button
                  onClick={handleContinue}
                  disabled={loading}
                  className={cn(
                    "w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2.5",
                    "transition-all duration-200 hover:opacity-95 active:scale-[0.98]",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    step === 3 && isWhatsappMode
                      ? "shadow-[0_4px_20px_rgba(37,211,102,0.35)]"
                      : "shadow-[0_4px_16px_rgba(0,0,0,0.15)]",
                  )}
                  style={{
                    backgroundColor:
                      step === 3 && isWhatsappMode
                        ? "var(--store-whatsapp,#25D366)"
                        : "var(--store-primary,#007AFF)",
                  }}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : step === 3 ? (
                    <>
                      {isWhatsappMode ? (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-5 w-5 fill-white"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d={WHATSAPP_ICON_PATH} />
                        </svg>
                      ) : (
                        <Receipt className="h-5 w-5" />
                      )}
                      <span>{checkoutButtonText}</span>
                    </>
                  ) : (
                    <>
                      <span>Continuar</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
