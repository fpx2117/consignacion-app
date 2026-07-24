"use client";

import { useEffect, useState } from "react";
import { initMercadoPago } from "@mercadopago/sdk-react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, ExternalLink, ShieldCheck, Zap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
import { useDolarBlue } from "@/hooks/useDolarBlue";

const ARSFormatter = new Intl.NumberFormat("es-AR", {
  style: "decimal",
  useGrouping: true,
});

interface PaymentProcessProps {
  planId: string;
  amount: number;
  currency: "ARS" | "USD";
  onClose: () => void;
  basePriceUSD?: number;
}

export function SubscriptionCheckout({
  planId,
  amount,
  currency,
  onClose,
  basePriceUSD,
}: PaymentProcessProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rate, isLoading: rateLoading } = useDolarBlue();

  useEffect(() => {
    // Initialize MP with Public Key
    initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "TEST-PUBLIC-KEY");
  }, []);

  const handleMercadoPagoRedirect = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/subscriptions/mercadopago/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Error al iniciar Mercado Pago");

      if (data.initPoint) {
        // Redirección directa al checkout de Mercado Pago
        window.location.href = data.initPoint;
      } else {
        throw new Error("No se recibió la URL de pago de Mercado Pago");
      }
    } catch (err: unknown) {
      console.error("Mercado Pago redirect error:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
      setLoading(false);
    }
  };

  const handlePayPalRedirect = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/subscriptions/paypal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Error al iniciar PayPal");

      if (data.approveUrl) {
        // Redireccionamiento directo para evitar problemas de iframe/colores
        window.location.href = data.approveUrl;
      } else {
        throw new Error("No se recibió la URL de aprobación de PayPal");
      }
    } catch (err: unknown) {
      console.error("PayPal redirect error:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
      setLoading(false);
    }
  };

  return (
    <Portal>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/56 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-card text-card-foreground rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] max-w-md w-full max-h-[90vh] overflow-y-auto scrollbar-hide border border-border/50"
          >
            {/* Botón Cerrar */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary/80 transition-colors z-20"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Header Premium */}
            <div className="p-6 md:p-8 text-center border-b border-border/50 relative overflow-hidden bg-gradient-to-b from-primary/5 to-transparent">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-primary/30 rounded-full" />
              <h3 className="text-xl md:text-2xl font-black tracking-tighter leading-tight">
                Confirmar{" "}
                <span className="text-primary text-2xl md:text-3xl block">
                  Suscripción
                </span>
              </h3>
              <p className="mt-2 text-[11px] md:text-xs text-muted-foreground font-medium max-w-[240px] mx-auto leading-relaxed">
                Activá tu acceso premium y empezá a gestionar como un
                profesional.
              </p>

              <div className="mt-5 inline-flex flex-col items-center">
                <div className="bg-secondary/40 px-6 py-3 rounded-2xl border border-border/30 shadow-inner">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl md:text-3xl font-black text-foreground">
                      {currency === "ARS" ? "$" : "U$D"}{" "}
                      {currency === "ARS" ? (
                        rateLoading ? (
                          <span className="inline-block w-20 h-8 bg-muted/50 rounded-md animate-pulse align-middle" />
                        ) : (
                          ARSFormatter.format(
                            basePriceUSD
                              ? basePriceUSD * (rate || 1000)
                              : amount,
                          )
                        )
                      ) : (
                        amount
                      )}
                    </span>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      / mes
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-[10px] font-bold text-center"
                >
                  {error}
                </motion.div>
              )}

              {currency === "ARS" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-3 bg-primary rounded-full" />
                    <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                      Mercado Pago Argentina
                    </h4>
                  </div>
                  <div className="bg-secondary/10 p-6 rounded-[1.5rem] border border-border/40 flex flex-col items-center justify-center gap-4 group hover:border-primary/20 transition-all duration-500">
                    <ShieldCheck className="h-6 w-6 text-primary/30" />
                    <button
                      onClick={handleMercadoPagoRedirect}
                      disabled={loading}
                      className="w-full py-3.5 bg-[color:var(--provider-mercadopago)] text-[color:var(--ui-fx-white)] font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-[color:var(--provider-mercadopago-hover)] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Pagar con Mercado Pago"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-3 bg-[color:var(--provider-paypal-foreground)] rounded-full" />
                    <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                      Pasarela PayPal Global
                    </h4>
                  </div>
                  <div className="bg-secondary/10 p-6 rounded-[1.5rem] border border-border/40 flex flex-col items-center justify-center gap-6 group hover:border-[color:var(--provider-paypal-foreground)]/20 transition-all duration-500 overflow-hidden relative">
                    {/* Botón PayPal Personalizado */}
                    <button
                      onClick={handlePayPalRedirect}
                      disabled={loading}
                      className={cn(
                        "w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 relative z-10 shadow-lg",
                        "bg-[color:var(--provider-paypal)] text-[color:var(--provider-paypal-foreground)] hover:bg-[color:var(--provider-paypal-hover)] active:scale-[0.97] disabled:opacity-50",
                      )}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5 fill-current" />
                          Activar con PayPal
                        </>
                      )}
                    </button>

                    <div className="flex flex-col items-center gap-2">
                      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5">
                        <ExternalLink className="h-3 w-3" /> Redirección Segura
                      </p>
                    </div>

                    {/* Decoración de fondo */}
                    <div className="absolute top-0 right-0 p-3 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                      <ShieldCheck className="h-16 w-16 -mr-4 -mt-4 rotate-12" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 md:p-8 bg-secondary/30 flex flex-col gap-5">
              <div className="flex items-center justify-center gap-5 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.15em]">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[color:var(--status-success-strong)]/60 rounded-full animate-pulse" />{" "}
                  256-bit SSL
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[color:var(--status-success-strong)]/60 rounded-full animate-pulse" />{" "}
                  Sin Permanencia
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3.5 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] hover:text-foreground transition-all border border-border/60 rounded-xl hover:bg-secondary active:scale-[0.98]"
              >
                Volver Atrás
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </Portal>
  );
}
