"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, CreditCard, DollarSign, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";

import { SUBSCRIPTION_PLANS, SubscriptionPlan } from "@/constants/subscriptions";

const ARSFormatter = new Intl.NumberFormat("es-AR", {
    style: "decimal",
    useGrouping: true,
});

interface PricingTableProps {
    onSelectPlan: (plan: SubscriptionPlan, currency: "ARS" | "USD") => void;
    currentPlanId?: number;
}

export function PricingTable({ onSelectPlan, currentPlanId }: PricingTableProps) {
    const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");

    return (
        <div className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Accents */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -z-10" />

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

                {/* Currency Toggle Redesign */}
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

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto items-stretch">
                {SUBSCRIPTION_PLANS.map((plan) => (
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
                                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black bg-white text-primary uppercase tracking-widest shadow-lg">
                                    Recomendado
                                </span>
                            </div>
                        )}

                        <div className="mb-10">
                            <h3 className={cn(
                                "text-2xl font-black tracking-tight mb-2",
                                plan.popular ? "text-white" : "text-foreground group-hover/card:text-primary transition-colors"
                            )}>{plan.nombre}</h3>
                            <p className={cn(
                                "text-sm font-medium leading-relaxed",
                                plan.popular ? "text-white/80" : "text-muted-foreground"
                            )}>{plan.descripcion}</p>
                        </div>

                        <div className="mb-10">
                            <div className="flex items-baseline gap-1">
                                <span className={cn(
                                    "text-5xl font-black tracking-tighter",
                                    plan.popular ? "text-white" : "text-foreground"
                                )}>
                                    {currency === "ARS" ? "$" : "U$D"}
                                    {currency === "ARS" ? ARSFormatter.format(plan.precioARS) : plan.precioUSD}
                                </span>
                                <span className={cn(
                                    "text-sm font-bold uppercase tracking-widest",
                                    plan.popular ? "text-white/60" : "text-muted-foreground"
                                )}>/ mes</span>
                            </div>
                        </div>

                        <ul className="flex-1 space-y-5 mb-10">
                            {plan.features.map((feature, index) => (
                                <li key={index} className="flex items-start gap-4 group/feat">
                                    <div className={cn(
                                        "h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover/feat:scale-110",
                                        plan.popular ? "bg-white/20" : "bg-primary/10"
                                    )}>
                                        <Check className={cn("h-3 w-3", plan.popular ? "text-white" : "text-primary")} />
                                    </div>
                                    <span className={cn(
                                        "text-sm font-medium",
                                        plan.popular ? "text-white/90" : "text-foreground/80"
                                    )}>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => onSelectPlan(plan, currency)}
                            disabled={plan.id === currentPlanId}
                            className={cn(
                                "w-full py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 active:scale-[0.95]",
                                plan.id === currentPlanId
                                    ? "bg-secondary text-muted-foreground border border-border cursor-default"
                                    : plan.popular
                                        ? "bg-white text-primary hover:bg-opacity-90 shadow-xl"
                                        : "bg-primary text-primary-foreground hover:shadow-[0_10px_20px_-10px_rgba(var(--primary),0.5)]"
                            )}
                        >
                            {plan.id === currentPlanId ? <Check className="h-4 w-4" /> : plan.id === 3 ? <Star className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                            {plan.id === currentPlanId ? "Tu Plan Actual" : "Suscribirme"}
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
