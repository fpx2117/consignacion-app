"use client";

import { motion } from "motion/react";
import { CreditCard, CheckCircle2, Loader2, Tag, ExternalLink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { toast } from "sonner";
import { StepWrapper } from "../StepWrapper";
import type { SubscriptionPlan } from "@/constants/subscriptions";
import { useDolarBlue } from "@/hooks/useDolarBlue";

interface PaymentStepProps {
  plan: SubscriptionPlan;
  onPaymentSuccess: (promoCode?: string, paymentId?: string) => Promise<void>;
  loading: boolean;
}

export function PaymentStep({ plan, onPaymentSuccess, loading }: PaymentStepProps) {
  const [promoCode, setPromoCode] = useState("");
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoApplied, setPromoApplied] = useState<{
    valid: boolean;
    discountPercentage: number;
    planId?: string;
    planName?: string;
  } | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { rate, isLoading: isLoadingDolar } = useDolarBlue();

  // Calcular precio dinámico basado en dólar cripto (ignorar precio de DB)
  const calculatedPrice = Math.round(plan.precioUSD * (rate || 1200));
  const finalPrice = promoApplied?.discountPercentage === 100 ? 0 : calculatedPrice;

  const handleApplyPromo = async () => {
    if (!promoCode) return;
    setIsValidatingPromo(true);
    try {
      const res = await fetch("/api/setup/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode, planId: plan.id }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setPromoApplied({
          valid: true,
          discountPercentage: data.discountPercentage,
          planId: data.planId,
          planName: data.planName,
        });
        toast.success(`Licencia de ${data.planName} activada!`);
      } else {
        setPromoApplied({ valid: false, discountPercentage: 0 });
        toast.error(data.error || "Licencia inválida");
      }
    } catch {
      toast.error("Error al validar licencia");
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handlePayPalPayment = async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch("/api/setup/create-paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();
      if (res.ok && data.approveUrl) {
        window.location.href = data.approveUrl;
      } else {
        toast.error(data.error || "Error al iniciar PayPal");
        setIsRedirecting(false);
      }
    } catch {
      toast.error("Error de conexión");
      setIsRedirecting(false);
    }
  };

  const handleMercadoPagoPayment = async () => {
    setIsRedirecting(true);
    try {
      const res = await fetch("/api/setup/create-mp-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();
      if (res.ok && data.initPoint) {
        window.location.href = data.initPoint;
      } else {
        toast.error(data.error || "Error al iniciar suscripción de Mercado Pago");
        setIsRedirecting(false);
      }
    } catch {
      toast.error("Error de conexión");
      setIsRedirecting(false);
    }
  };

  const activePlanName = promoApplied?.planName || plan.nombre;

  return (
    <StepWrapper maxWidth="xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto space-y-8"
      >
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-foreground">
            {promoApplied?.valid ? "Licencia Activada" : "Resumen de Activación"}
          </h2>
          <p className="text-muted-foreground font-medium">
            {promoApplied?.valid
              ? "Tu licencia ha sido validada con éxito."
              : "Estás a un paso de activar tu ecosistema."}
          </p>
        </div>

        <div className="p-8 rounded-[2.5rem] bg-card/40 backdrop-blur-xl border border-border/50 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-[color:var(--primary)]/5 to-transparent pointer-events-none" />

          {/* Plan + Price */}
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--primary)] mb-1">
                {promoApplied?.valid ? "Plan Licenciado" : "Plan Seleccionado"}
              </p>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black">{activePlanName}</h3>
                {promoApplied?.valid && (
                  <span className="px-2 py-0.5 rounded-full bg-[color:var(--status-success-strong)]/10 border border-[color:var(--status-success-strong)]/20 text-[color:var(--status-success-strong)] text-[10px] font-bold uppercase">
                    Licencia OK
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Costo</p>
              <p className={`text-2xl font-black ${promoApplied?.valid ? "text-[color:var(--status-success-strong)]" : "text-foreground"}`}>
                {promoApplied?.valid ? "Bonificado" : isLoadingDolar ? (
                  <span className="inline-block w-20 h-6 bg-muted/50 rounded animate-pulse" />
                ) : `$${calculatedPrice.toLocaleString()}`}
              </p>
            </div>
          </div>

          <Separator className="my-8 bg-border/50" />

          {/* Promo Code */}
          <div className="space-y-4 relative z-10">
            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 flex items-center gap-2">
              <Tag className="w-4 h-4" /> Código de Licencia
            </Label>
            <div className="flex gap-2">
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="TU-CODIGO-AQUI"
                className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-[color:var(--primary)]/50 uppercase font-bold tracking-widest"
                disabled={promoApplied?.valid || isValidatingPromo || loading || isRedirecting}
              />
              <Button
                variant={promoApplied?.valid ? "outline" : "default"}
                className={`h-12 px-6 rounded-xl font-bold tracking-widest ${
                  !promoApplied?.valid
                    ? "bg-[color:var(--primary)] hover:bg-[color:var(--primary)] text-[color:var(--ui-fx-white)]"
                    : "border-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10 hover:bg-[color:var(--status-success-strong)]/20"
                }`}
                onClick={promoApplied?.valid ? () => setPromoApplied(null) : handleApplyPromo}
                disabled={!promoCode || isValidatingPromo || loading || isRedirecting}
              >
                {isValidatingPromo ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : promoApplied?.valid ? (
                  "Quitar"
                ) : (
                  "Validar"
                )}
              </Button>
            </div>
            {promoApplied?.valid === false && (
              <p className="text-xs font-bold text-destructive">Código inválido o ya utilizado.</p>
            )}
          </div>

          <Separator className="my-8 bg-border/50" />

          {/* Total */}
          <div className="flex items-center justify-between mb-8 relative z-10">
            <span className="text-lg font-black uppercase tracking-widest">A pagar hoy</span>
            <span className="text-4xl font-black text-[color:var(--primary)]">
              {isLoadingDolar ? (
                <span className="inline-block w-32 h-10 bg-muted/50 rounded animate-pulse" />
              ) : (
                `$${finalPrice.toLocaleString()}`
              )}
            </span>
          </div>

          {/* Payment Buttons */}
          <div className="relative z-10">
            {finalPrice === 0 ? (
              <Button
                className="w-full h-16 rounded-2xl bg-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)] text-[color:var(--ui-fx-white)] font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                onClick={() => onPaymentSuccess(promoCode)}
                disabled={loading || isRedirecting}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-3" />
                )}
                Activar con Licencia
              </Button>
            ) : (
              <div className="flex flex-col gap-4">
                <Button
                  className="w-full h-16 rounded-2xl bg-[color:var(--provider-mercadopago)] hover:bg-[color:var(--provider-mercadopago-hover)] text-[color:var(--ui-fx-white)] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3"
                  onClick={handleMercadoPagoPayment}
                  disabled={loading || isRedirecting}
                >
                  {isRedirecting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Pagar con Mercado Pago
                      <ExternalLink className="w-4 h-4 opacity-50" />
                    </>
                  )}
                </Button>
                <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-50 my-2">
                  ó
                </p>
                <Button
                  className="w-full h-16 rounded-2xl bg-[color:var(--provider-paypal)] hover:bg-[color:var(--provider-paypal-hover)] text-[color:var(--provider-paypal-foreground)] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-3"
                  onClick={handlePayPalPayment}
                  disabled={loading || isRedirecting}
                >
                  {isRedirecting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-current" />
                      Activar con PayPal
                      <ExternalLink className="w-4 h-4 opacity-50" />
                    </>
                  )}
                </Button>
              </div>
            )}
            {finalPrice > 0 && !isRedirecting && (
              <p className="text-center text-xs text-muted-foreground mt-6 font-medium bg-secondary/20 p-3 rounded-xl border border-border/10">
                Confirmarás tus datos después de completar el pago seguro.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </StepWrapper>
  );
}
