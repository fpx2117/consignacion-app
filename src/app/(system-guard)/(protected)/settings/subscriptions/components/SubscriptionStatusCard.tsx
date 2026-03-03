/* eslint-disable */
// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, RefreshCw, Star, Zap, XCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CancelSubscriptionModal } from "./CancelSubscriptionModal";

interface SubscriptionInfo {
    hasSubscription: boolean;
    subscription?: {
        status: string;
        provider: string;
        plan: {
            nombre: string;
            precioARS: number;
        };
        daysRemaining: number;
        currentPeriodEnd?: string;
        trialEndsAt?: string;
    };
}

export function SubscriptionStatusCard({ onUpgrade }: { onUpgrade: () => void }) {
    const [data, setData] = useState<SubscriptionInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    const fetchSubscription = () => {
        setLoading(true);
        fetch("/api/subscriptions/current")
            .then((res) => res.json())
            .then((json) => {
                setData(json);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchSubscription();
    }, []);

    const handleCancel = async () => {
        setCancelling(true);
        try {
            const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
            const result = await res.json();

            if (res.ok) {
                toast.success("Suscripción cancelada exitosamente");
                setShowCancelModal(false);
                fetchSubscription(); // Recargar datos
            } else {
                toast.error(result.error || "No se pudo cancelar la suscripción");
            }
        } catch (error) {
            console.error("Cancel error:", error);
            toast.error("Error de conexión al cancelar");
        } finally {
            setCancelling(false);
        }
    };

    if (loading) {
        return (
            <Card className="p-8 animate-pulse bg-card/40 backdrop-blur-xl border-border/50 rounded-[2rem]">
                <div className="h-4 w-32 bg-muted rounded mb-4"></div>
                <div className="h-8 w-64 bg-muted rounded mb-6"></div>
                <div className="h-20 w-full bg-muted rounded"></div>
            </Card>
        );
    }

    const sub = data?.subscription;

    return (
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-card/40 to-card/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] rounded-[2.5rem] p-6 md:p-10 transition-all duration-500 hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] group">
            <div className="relative z-10 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Gestión de Suscripción</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 md:gap-4">
                            <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground bg-clip-text">
                                {sub?.plan.nombre || "Sin Plan"}
                            </h2>
                            {sub?.status === "PRUEBA" && (
                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Trial Mode
                                </Badge>
                            )}
                            {sub?.status === "ACTIVO" && (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Premium Active
                                </Badge>
                            )}
                            {sub?.status === "CANCELADO" && (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Cancelada
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground font-medium opacity-70">
                            {sub?.plan.nombre === "Básico"
                                ? "Plan de entrada para pequeños negocios."
                                : sub?.plan.nombre === "Pro"
                                    ? "Mantené tu negocio en crecimiento constante."
                                    : sub?.plan.nombre === "Enterprise"
                                        ? "Potencia total para operaciones a gran escala."
                                        : "Empezá hoy mismo tu experiencia premium."}
                        </p>
                    </div>

                    <button
                        onClick={onUpgrade}
                        className="relative group/btn flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-black rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-[0_10px_20px_-10px_rgba(var(--primary),0.5)] overflow-hidden"
                    >
                        <Zap className="h-4 w-4 relative z-10 group-hover/btn:animate-pulse" />
                        <span className="relative z-10">{data?.hasSubscription ? "Ver Planes & Upgrade" : "Activar Ahora"}</span>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                    </button>
                </div>

                {data?.hasSubscription ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 pt-8 border-t border-border/10">
                            <div className="group/item flex items-center gap-4 p-5 md:p-6 bg-secondary/30 hover:bg-secondary/50 rounded-3xl border border-border/50 transition-all duration-300">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover/item:rotate-12 transition-transform duration-500">
                                    <Calendar className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase font-black text-muted-foreground tracking-[0.15em] mb-0.5">Próximo Vencimiento</p>
                                    <p className="text-lg font-bold tracking-tight">
                                        {sub?.currentPeriodEnd
                                            ? new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
                                            : sub?.trialEndsAt
                                                ? new Date(sub.trialEndsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
                                                : "No programado"}
                                    </p>
                                </div>
                            </div>

                            <div className="group/item flex items-center gap-4 p-5 md:p-6 bg-secondary/30 hover:bg-secondary/50 rounded-3xl border border-border/50 transition-all duration-300">
                                <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center group-hover/item:-rotate-12 transition-transform duration-500">
                                    <RefreshCw className="h-6 w-6 text-orange-500" />
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase font-black text-muted-foreground tracking-[0.15em] mb-0.5">Vigencia Restante</p>
                                    <p className="text-lg font-bold tracking-tight">
                                        <span className={cn(
                                            sub?.daysRemaining && sub.daysRemaining <= 3 ? "text-orange-500" : "text-foreground"
                                        )}>
                                            {sub?.daysRemaining}
                                        </span>
                                        <span className="text-sm font-medium ml-1">días</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {sub?.status === "ACTIVO" && (
                            <div className="flex justify-end pt-4 border-t border-border/10">
                                <button
                                    onClick={() => setShowCancelModal(true)}
                                    disabled={cancelling}
                                    className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-destructive/5"
                                >
                                    <XCircle className="h-3 w-3" />
                                    Cancelar Suscripción
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-8 bg-primary/5 rounded-[2rem] border border-primary/10 flex items-center gap-4">
                        <Star className="h-8 w-8 text-primary/40 flex-shrink-0" />
                        <p className="text-sm md:text-base text-primary/80 font-medium leading-relaxed">
                            Potencia tu negocio con el sistema líder de consignaciones.
                            Suscribite a un plan y desbloquea el control total de tu stock.
                        </p>
                    </div>
                )}
            </div>

            <CancelSubscriptionModal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={handleCancel}
                loading={cancelling}
            />

            {/* Premium Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-80 transition-opacity duration-700" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 opacity-30 group-hover:opacity-50 transition-opacity duration-700" />
        </Card>
    );
}
