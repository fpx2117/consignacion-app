/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { PricingTable } from "./components/PricingTable";
import { AnimatePresence, motion } from "framer-motion";
import { SubscriptionCheckout } from "./components/PaymentProcess";
import { SubscriptionStatusCard } from "./components/SubscriptionStatusCard";
import { ArrowLeft, CheckCircle2, XCircle, Gift, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { DowngradeModal } from "./components/DowngradeModal";
import { TutorialButton } from "@/components/ui/tutorial-button";
import { SUBSCRIPTIONS_TUTORIAL } from "@/lib/tutorial-content";

export default function SubscriptionsPage() {
    const [showPricing, setShowPricing] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
    const [currentSub, setCurrentSub] = useState<any>(null);
    const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
    const [pendingPlan, setPendingPlan] = useState<any>(null);

    // Promo code state
    const [showPromo, setShowPromo] = useState(false);
    const [promoCode, setPromoCode] = useState("");
    const [promoLoading, setPromoLoading] = useState(false);

    const searchParams = useSearchParams();
    const router = useRouter();

    const fetchCurrentSub = async () => {
        try {
            const res = await fetch("/api/subscriptions/current");
            const json = await res.json();
            setCurrentSub(json.subscription);
        } catch (error) {
            console.error("Error fetching sub:", error);
        }
    };

    useEffect(() => {
        fetchCurrentSub();
    }, []);

    useEffect(() => {
        const status = searchParams.get("status");
        if (status === "success") {
            toast.success("¡Suscripción iniciada!", {
                description: "Tu pago está siendo procesado por PayPal.",
                icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            });
            router.replace("/settings/subscriptions");
        } else if (status === "cancel") {
            toast.error("Proceso cancelado", {
                description: "La operación de PayPal fue cancelada.",
                icon: <XCircle className="h-4 w-4 text-destructive" />
            });
            router.replace("/settings/subscriptions");
        }
    }, [searchParams, router]);

    const handleSelectPlan = (plan: any, curr: "ARS" | "USD") => {
        // Detectar si es un downgrade
        // Asumimos que IDs más bajos son planes más bajos (1: Básico, 2: Pro, 3: Enterprise)
        if (currentSub && plan.id < currentSub.planId) {
            setPendingPlan({ plan, currency: curr });
            setShowDowngradeWarning(true);
        } else {
            setSelectedPlan(plan);
            setCurrency(curr);
        }
    };

    const confirmDowngrade = () => {
        if (pendingPlan) {
            setSelectedPlan(pendingPlan.plan);
            setCurrency(pendingPlan.currency);
        }
        setShowDowngradeWarning(false);
    };

    const handleRedeemPromo = async () => {
        if (!promoCode.trim()) return;
        setPromoLoading(true);
        try {
            const res = await fetch("/api/subscriptions/promo/redeem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: promoCode.trim() }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error("Código inválido", {
                    description: data.error || "No se pudo canjear el código.",
                    icon: <XCircle className="h-4 w-4 text-destructive" />,
                });
                return;
            }

            toast.success("¡Código canjeado!", {
                description: data.message,
                icon: <Gift className="h-4 w-4 text-emerald-500" />,
            });

            setPromoCode("");
            setShowPromo(false);
            router.refresh();
        } catch {
            toast.error("Error de conexión");
        } finally {
            setPromoLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-10">
            <AnimatePresence mode="wait">
                {!showPricing ? (
                    <motion.div
                        key="status"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                    >
                        {/* Minimal Header for Status View */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div className="space-y-1">
                                <Link
                                    href="/settings"
                                    className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-[0.2em] mb-4 hover:opacity-70 transition-all w-fit"
                                >
                                    <ArrowLeft className="h-3 w-3" />
                                    Volver a Configuración
                                </Link>
                                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
                                    Suscripción
                                </h1>
                                <p className="text-sm text-muted-foreground font-medium opacity-60">
                                    Control de tu plan actual y facturación.
                                </p>
                                <TutorialButton steps={SUBSCRIPTIONS_TUTORIAL} />
                            </div>
                        </div>

                        <SubscriptionStatusCard onUpgrade={() => setShowPricing(true)} />

                        {/* Promo Code Section */}
                        <div className="mt-2">
                            <button
                                onClick={() => setShowPromo(!showPromo)}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
                            >
                                <Gift className="h-4 w-4" />
                                Tengo un código promocional
                            </button>

                            <AnimatePresence>
                                {showPromo && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex gap-3 mt-4 max-w-md">
                                            <input
                                                type="text"
                                                value={promoCode}
                                                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                                onKeyDown={(e) => e.key === "Enter" && handleRedeemPromo()}
                                                placeholder="Ej: WELCOME2026"
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm font-mono tracking-wider text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                                disabled={promoLoading}
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleRedeemPromo}
                                                disabled={promoLoading || !promoCode.trim()}
                                                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                            >
                                                {promoLoading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    "Canjear"
                                                )}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="pricing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                    >
                        <div className="flex justify-start">
                            <button
                                onClick={() => setShowPricing(false)}
                                className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-[0.2em] hover:opacity-70 transition-all"
                            >
                                <ArrowLeft className="h-3 w-3" />
                                Volver al estado actual
                            </button>
                        </div>
                        {/* PricingTable already has its own huge header, so we let it shine alone */}
                        <PricingTable
                            onSelectPlan={(plan, curr) => handleSelectPlan(plan, curr)}
                            currentPlanId={currentSub?.planId}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedPlan && (
                    <SubscriptionCheckout
                        planId={currency === "ARS" ? selectedPlan.mercadopagoPlanId : selectedPlan.paypalId}
                        amount={currency === "ARS" ? selectedPlan.precioARS : selectedPlan.precioUSD}
                        basePriceUSD={selectedPlan.precioUSD}
                        currency={currency}
                        onClose={() => setSelectedPlan(null)}
                    />
                )}
            </AnimatePresence>

            <DowngradeModal
                isOpen={showDowngradeWarning}
                onClose={() => setShowDowngradeWarning(false)}
                onConfirm={confirmDowngrade}
                newPlanName={pendingPlan?.plan.nombre}
            />
        </div>
    );
}
