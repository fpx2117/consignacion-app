"use client";

import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Loader2, Tag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { SubscriptionPlan } from "@/constants/subscriptions";

interface PaymentStepProps {
    plan: SubscriptionPlan;
    onPaymentSuccess: (promoCode?: string) => Promise<void>;
    loading: boolean;
}

export function PaymentStep({ plan, onPaymentSuccess, loading }: PaymentStepProps) {
    const [promoCode, setPromoCode] = useState("");
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);
    const [promoApplied, setPromoApplied] = useState<{ valid: boolean, discountPercentage: number } | null>(null);

    // Mock validation for UI purposes
    const handleApplyPromo = async () => {
        if (!promoCode) return;
        setIsValidatingPromo(true);
        // Simulate network
        await new Promise(r => setTimeout(r, 600));

        if (promoCode.toUpperCase() === "FREE100" || promoCode.toUpperCase() === "ALLDATA") {
            setPromoApplied({ valid: true, discountPercentage: 100 });
        } else {
            setPromoApplied({ valid: false, discountPercentage: 0 });
        }
        setIsValidatingPromo(false);
    };

    const finalPrice = promoApplied?.discountPercentage === 100 ? 0 : plan.precioARS;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl mx-auto space-y-8 py-8"
        >
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black tracking-tight text-foreground">
                    Resumen de Compra
                </h2>
                <p className="text-muted-foreground font-medium">Estás a un paso de activar tu ecosistema.</p>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-card/40 backdrop-blur-xl border border-border/50 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />

                {/* Plan Summary */}
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-1">Plan Seleccionado</p>
                        <h3 className="text-2xl font-black">{plan.nombre}</h3>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Mensual</p>
                        <p className={`text-2xl font-black ${promoApplied?.valid && promoApplied.discountPercentage === 100 ? "line-through text-muted-foreground opacity-50" : "text-foreground"}`}>
                            ${plan.precioARS.toLocaleString()}
                        </p>
                    </div>
                </div>

                <Separator className="my-8 bg-border/50" />

                {/* Promo Code */}
                <div className="space-y-4 relative z-10">
                    <Label htmlFor="promo" className="text-xs font-bold uppercase tracking-widest text-foreground/80 flex items-center gap-2">
                        <Tag className="w-4 h-4" /> Código Promocional
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="promo"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            placeholder="Ej: LANZAMIENTO2026"
                            className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-violet-500/50 uppercase font-bold tracking-widest"
                            disabled={promoApplied?.valid || isValidatingPromo || loading}
                        />
                        <Button
                            variant={promoApplied?.valid ? "outline" : "default"}
                            className={`h-12 px-6 rounded-xl font-bold tracking-widest ${!promoApplied?.valid ? "bg-violet-600 hover:bg-violet-700 text-white" : "border-emerald-500 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20"}`}
                            onClick={promoApplied?.valid ? () => setPromoApplied(null) : handleApplyPromo}
                            disabled={!promoCode || isValidatingPromo || loading}
                        >
                            {isValidatingPromo ? <Loader2 className="w-5 h-5 animate-spin" /> : (promoApplied?.valid ? "Quitar" : "Aplicar")}
                        </Button>
                    </div>
                    {promoApplied?.valid === false && (
                        <p className="text-xs font-bold text-destructive">Código inválido o expirado.</p>
                    )}
                    {promoApplied?.valid === true && (
                        <p className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> ¡Código aplicado con éxito!
                        </p>
                    )}
                </div>

                <Separator className="my-8 bg-border/50" />

                {/* Total */}
                <div className="flex items-center justify-between mb-8 relative z-10">
                    <span className="text-lg font-black uppercase tracking-widest">Total a Pagar</span>
                    <span className="text-4xl font-black text-violet-600">
                        ${finalPrice.toLocaleString()}
                    </span>
                </div>

                {/* Action */}
                <div className="relative z-10">
                    {finalPrice === 0 ? (
                        <Button
                            className="w-full h-16 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                            onClick={() => onPaymentSuccess(promoCode)}
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5 mr-3" />
                            )}
                            Crear Instancia
                        </Button>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Button
                                className="w-full h-14 rounded-xl bg-[#009EE3] hover:bg-[#008ACA] text-white font-bold tracking-wide transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                                onClick={() => onPaymentSuccess()} // Replace with MP checkout init
                                disabled={loading}
                            >
                                <CreditCard className="w-5 h-5 mr-2" /> Mercado Pago
                            </Button>
                            <Button
                                className="w-full h-14 rounded-xl bg-[#003087] hover:bg-[#002266] text-white font-bold tracking-wide transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                                onClick={() => onPaymentSuccess()} // Replace with PayPal checkout init
                                disabled={loading}
                            >
                                <CreditCard className="w-5 h-5 mr-2" /> PayPal
                            </Button>
                        </div>
                    )}
                    {finalPrice > 0 && (
                        <p className="text-center text-xs text-muted-foreground mt-4 font-medium">Serás redirigido a la pasarela de pago segura.</p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

