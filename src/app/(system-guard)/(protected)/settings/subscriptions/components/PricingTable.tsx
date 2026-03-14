/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Zap, Star, AlertTriangle, X, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { SUBSCRIPTION_PLANS, SubscriptionPlan } from "@/constants/subscriptions";
import { useDolarBlue } from "@/hooks/useDolarBlue";

const ENABLED_PLAN_IDS = [2, 3] as const;
const isEnabledPlan = (planId: number) => ENABLED_PLAN_IDS.includes(planId as (typeof ENABLED_PLAN_IDS)[number]);

const ARSFormatter = new Intl.NumberFormat("es-AR", {
    style: "decimal",
    useGrouping: true,
});

interface PricingTableProps {
    onSelectPlan: (plan: SubscriptionPlan, currency: "ARS" | "USD") => void;
    currentPlanId?: number;
}

// ─── Downgrade Warning Modal ────────────────────────────────────────────────
interface DowngradeModalProps {
    targetPlan: SubscriptionPlan;
    currentPlan: SubscriptionPlan;
    currency: "ARS" | "USD";
    onConfirm: () => void;
    onCancel: () => void;
}

function DowngradeWarningModal({ targetPlan, currentPlan, currency, onConfirm, onCancel }: DowngradeModalProps) {
    // Features the user will LOSE (in currentPlan but not in targetPlan)
    const lostFeatures = currentPlan.features.filter(
        (f) => !targetPlan.features.some((tf) => tf.toLowerCase().includes(f.toLowerCase().split(" ")[0]))
    );

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={onCancel}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-foreground/70 backdrop-blur-sm" />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                    className="relative w-full max-w-md bg-card border border-border rounded-[2rem] shadow-2xl overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Warning Header */}
                    <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-[color:var(--status-warning)]/10 via-[color:var(--status-warning)]/5 to-transparent border-b border-border/50">
                        <button
                            onClick={onCancel}
                            className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-muted/80 text-muted-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-[color:var(--status-warning)]/15 border border-[color:var(--status-warning)]/30 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="h-7 w-7 text-[color:var(--status-warning)]" />
                            </div>
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[color:var(--status-warning)]/10 border border-[color:var(--status-warning)]/20 text-[color:var(--status-warning)] text-[10px] font-black uppercase tracking-widest mb-1">
                                    <TrendingDown className="h-3 w-3" />
                                    Bajada de plan
                                </div>
                                <h3 className="text-xl font-black text-foreground tracking-tight">
                                    ¿Estás seguro?
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-8 py-6 space-y-5">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Estás a punto de bajar de{" "}
                            <span className="font-black text-foreground">{currentPlan.nombre}</span>{" "}
                            a{" "}
                            <span className="font-black text-foreground">{targetPlan.nombre}</span>.
                            Perderás acceso a las siguientes funcionalidades:
                        </p>

                        {/* Lost features */}
                        <div className="rounded-2xl border border-[color:var(--status-warning)]/20 bg-[color:var(--status-warning)]/5 p-4 space-y-3">
                            {lostFeatures.length > 0 ? (
                                lostFeatures.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="h-5 w-5 rounded-full bg-[color:var(--status-danger)]/15 border border-[color:var(--status-danger)]/20 flex items-center justify-center flex-shrink-0">
                                            <X className="h-3 w-3 text-[color:var(--status-danger)]" />
                                        </div>
                                        <span className="text-sm font-semibold text-foreground/80 line-through decoration-red-500/50">
                                            {feature}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                // Fallback: show current plan features as lost
                                currentPlan.features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="h-5 w-5 rounded-full bg-[color:var(--status-danger)]/15 border border-[color:var(--status-danger)]/20 flex items-center justify-center flex-shrink-0">
                                            <X className="h-3 w-3 text-[color:var(--status-danger)]" />
                                        </div>
                                        <span className="text-sm font-semibold text-foreground/80">
                                            {feature}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground/70 leading-relaxed">
                            El cambio se aplicará de inmediato. Podés volver a actualizar tu plan en cualquier momento.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="px-8 pb-8 flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 py-3.5 px-4 rounded-2xl border border-border font-bold text-xs uppercase tracking-widest text-muted-foreground hover:bg-muted/50 transition-all duration-200"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 py-3.5 px-4 rounded-2xl bg-[color:var(--status-warning)] hover:bg-[color:var(--status-warning)] text-[color:var(--ui-fx-white)] font-black text-xs uppercase tracking-widest transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 active:scale-[0.97]"
                        >
                            Sí, bajar plan
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function PricingTable({ onSelectPlan, currentPlanId }: PricingTableProps) {
    const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
    const [plans, setPlans] = useState<SubscriptionPlan[]>(
        SUBSCRIPTION_PLANS.filter((plan) => isEnabledPlan(plan.id))
    );
    const { rate, isLoading } = useDolarBlue();

    // Downgrade warning state
    const [downgradeTarget, setDowngradeTarget] = useState<{ plan: SubscriptionPlan; currency: "ARS" | "USD" } | null>(null);

    // Cargar precios reales desde la Base de Datos
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch('/api/subscriptions/plans');
                if (res.ok) {
                    const data = await res.json();
                    const basePlans = SUBSCRIPTION_PLANS.filter((plan) => isEnabledPlan(plan.id));
                    const mergedPlans = basePlans.map(basePlan => {
                        const dbPlan = data.plans.find((p: any) => p.id === basePlan.id);
                        if (dbPlan) {
                            return {
                                ...basePlan,
                                precioUSD: dbPlan.precioUSD ? Number(dbPlan.precioUSD) : basePlan.precioUSD,
                                precioARS: dbPlan.precioARS ? Number(dbPlan.precioARS) : basePlan.precioARS,
                                nombre: dbPlan.nombre || basePlan.nombre
                            };
                        }
                        return basePlan;
                    });
                    setPlans(mergedPlans);
                }
            } catch (error) {
                console.error("Failed to load plans from DB, using defaults", error);
            }
        };
        fetchPlans();
    }, []);

    // Intercept plan selection: show warning if downgrading
    const handleSelectPlan = (plan: SubscriptionPlan, selectedCurrency: "ARS" | "USD") => {
        if (currentPlanId && plan.id < currentPlanId) {
            setDowngradeTarget({ plan, currency: selectedCurrency });
        } else {
            onSelectPlan(plan, selectedCurrency);
        }
    };

    const currentPlan = SUBSCRIPTION_PLANS.find((plan) => plan.id === currentPlanId);

    return (
        <>
            {/* Downgrade Warning Modal */}
            {downgradeTarget && currentPlan && (
                <DowngradeWarningModal
                    targetPlan={downgradeTarget.plan}
                    currentPlan={currentPlan}
                    currency={downgradeTarget.currency}
                    onConfirm={() => {
                        onSelectPlan(downgradeTarget.plan, downgradeTarget.currency);
                        setDowngradeTarget(null);
                    }}
                    onCancel={() => setDowngradeTarget(null)}
                />
            )}

            <div className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                {/* Background Accents */}
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[color:var(--primary)]/5 rounded-full blur-[100px] -z-10" />

                <div className="text-center mb-20 space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em]"
                    >
                        <Star className="h-3 w-3" />
                        Planes de Suscripción
                    </motion.div>
                    <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground max-w-3xl mx-auto leading-[0.9]">
                        Elevá tu gestión al <span className="text-primary">siguiente nivel.</span>
                    </h2>
                    <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto font-medium opacity-80">
                        Elegí la potencia que tu negocio necesita. Sin contratos largos, cancelá cuando quieras.
                    </p>

                    {/* Currency Toggle */}
                    <div className="mt-12 flex justify-center">
                        <div className="relative flex items-center p-1.5 bg-background/50 backdrop-blur-xl border border-border/50 rounded-3xl shadow-inner group">
                            <button
                                onClick={() => setCurrency("ARS")}
                                className={cn(
                                    "relative z-10 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-500",
                                    currency === "ARS" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                ARS
                            </button>
                            <button
                                onClick={() => setCurrency("USD")}
                                className={cn(
                                    "relative z-10 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-500",
                                    currency === "USD" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                USD
                            </button>
                            <div
                                className={cn(
                                    "absolute h-[calc(100%-12px)] w-[calc(50%-6px)] bg-primary rounded-2xl shadow-lg shadow-primary/20 transition-all duration-500 ease-in-out",
                                    currency === "ARS" ? "translate-x-0" : "translate-x-full"
                                )}
                            />
                        </div>
                    </div>
                </div>

                <div
                    className={cn(
                        "grid grid-cols-1 gap-8 mx-auto items-stretch",
                        plans.length === 2
                            ? "max-w-5xl md:grid-cols-2"
                            : "max-w-7xl md:grid-cols-2 lg:grid-cols-3"
                    )}
                >
                    {plans.map((plan) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            whileHover={{ y: -10 }}
                            className={cn(
                                "relative flex flex-col p-8 md:p-10 rounded-[2.5rem] transition-all duration-500 group/card",
                                plan.popular
                                    ? "bg-primary text-primary-foreground shadow-[0_20px_50px_-20px_rgba(var(--primary),0.5)] z-10 scale-[1.02] border-none"
                                    : "bg-card/40 backdrop-blur-xl border border-border/50 hover:border-primary/50 shadow-xl"
                            )}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 right-10 -translate-y-1/2">
                                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black bg-card text-primary uppercase tracking-widest shadow-lg">
                                        Recomendado
                                    </span>
                                </div>
                            )}

                            <div className="mb-10">
                                <h3 className={cn(
                                    "text-2xl font-black tracking-tight mb-2",
                                    plan.popular ? "text-[color:var(--ui-fx-white)]" : "text-foreground group-hover/card:text-primary transition-colors"
                                )}>{plan.nombre}</h3>
                                <p className={cn(
                                    "text-sm font-medium leading-relaxed",
                                    plan.popular ? "text-[color:var(--ui-fx-white)]/80" : "text-muted-foreground"
                                )}>{plan.descripcion}</p>
                            </div>

                            <div className="mb-10">
                                <div className="flex items-baseline gap-1">
                                    <span className={cn(
                                        "text-5xl font-black tracking-tighter",
                                        plan.popular ? "text-[color:var(--ui-fx-white)]" : "text-foreground"
                                    )}>
                                        {currency === "ARS" ? "$" : "U$D"}
                                        {currency === "ARS" ?
                                            isLoading ? (
                                                <span className="inline-block w-24 h-10 bg-muted/50 rounded-md animate-pulse align-middle" />
                                            ) : ARSFormatter.format(plan.precioUSD * (rate || 1000))
                                            : plan.precioUSD}
                                    </span>
                                    <span className={cn(
                                        "text-sm font-bold uppercase tracking-widest",
                                        plan.popular ? "text-[color:var(--ui-fx-white)]/60" : "text-muted-foreground"
                                    )}>/ mes</span>
                                </div>
                            </div>

                            <ul className="flex-1 space-y-5 mb-10">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-start gap-4 group/feat">
                                        <div className={cn(
                                            "h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover/feat:scale-110",
                                            plan.popular ? "bg-card/20" : "bg-primary/10"
                                        )}>
                                            <Check className={cn("h-3 w-3", plan.popular ? "text-[color:var(--ui-fx-white)]" : "text-primary")} />
                                        </div>
                                        <span className={cn(
                                            "text-sm font-medium",
                                            plan.popular ? "text-[color:var(--ui-fx-white)]/90" : "text-foreground/80"
                                        )}>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleSelectPlan(plan, currency)}
                                disabled={plan.id === currentPlanId || (currency === 'ARS' && isLoading)}
                                className={cn(
                                    "w-full py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.95]",
                                    plan.id === currentPlanId
                                        ? "bg-secondary text-muted-foreground border border-border cursor-default"
                                        : plan.popular
                                            ? "bg-card text-primary hover:bg-opacity-90 shadow-xl"
                                            : "bg-primary text-primary-foreground hover:shadow-[0_10px_20px_-10px_rgba(var(--primary),0.5)]"
                                )}
                            >
                                {plan.id === currentPlanId ? <Check className="h-4 w-4" /> : plan.id === 3 ? <Star className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                                {plan.id === currentPlanId ? "Tu Plan Actual" : "Suscribirme"}
                            </button>
                        </motion.div>
                    ))}
                </div>

                {currency === "ARS" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center mt-12"
                    >
                        <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 text-xs font-semibold text-muted-foreground/80 border border-border/50">
                            * Los precios en ARS son calculados en base a la cotización del dólar cripto y están sujetos a variaciones del mercado.
                        </p>
                    </motion.div>
                )}
            </div>
        </>
    );
}
