"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, ChevronRight, Ban, Clock, ShieldX } from "lucide-react";
import { Portal } from "@/components/ui/portal";

interface CancelSubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    loading?: boolean;
}

export function CancelSubscriptionModal({ isOpen, onClose, onConfirm, loading }: CancelSubscriptionModalProps) {
    if (!isOpen) return null;

    return (
        <Portal>
            <AnimatePresence>
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 md:p-6 bg-background/80 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-card border border-border/50 shadow-2xl rounded-[2.5rem] overflow-hidden"
                    >
                        {/* Header Decorative */}
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-destructive via-red-500 to-destructive" />

                        <div className="p-8 md:p-10 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                                    <ShieldX className="h-8 w-8 text-destructive" />
                                </div>
                                <button
                                    onClick={onClose}
                                    className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                                >
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-3xl font-black tracking-tight text-foreground">
                                    ¿Cancelar tu suscripción?
                                </h2>
                                <p className="text-muted-foreground font-medium">
                                    Lamentamos que te vayas. Al cancelar, tené en cuenta los siguientes puntos:
                                </p>
                            </div>

                            <div className="space-y-4 py-4">
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                                    <Clock className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-red-950">Acceso hasta el final</p>
                                        <p className="text-xs text-red-900/70 font-medium">
                                            Seguirás teniendo acceso a todas tus funciones premium hasta que termine el periodo de facturación actual.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                                    <Ban className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-red-950">Sin cargos adicionales</p>
                                        <p className="text-xs text-red-900/70 font-medium">
                                            No se te cobrará nada más a partir de este momento. El pago por renovación automática se detendrá.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-destructive/5 border border-destructive/10">
                                    <AlertCircle className="h-5 w-5 text-destructive mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-red-950">Gestión de datos</p>
                                        <p className="text-xs text-red-900/70 font-medium">
                                            Tus productos y consignaciones no se borrarán, pero el acceso a las funciones avanzadas se bloqueará al vencer el plan.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button
                                    onClick={onConfirm}
                                    disabled={loading}
                                    className="flex-1 h-14 bg-destructive hover:bg-destructive/90 text-white font-black rounded-2xl transition-all shadow-lg shadow-destructive/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? "Cancelando..." : "Confirmar Cancelación"}
                                    {!loading && <ChevronRight className="h-4 w-4" />}
                                </button>
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 h-14 bg-secondary text-secondary-foreground font-bold rounded-2xl hover:bg-secondary/80 transition-all active:scale-[0.98] disabled:opacity-50"
                                >
                                    Mantener Plan
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        </Portal>
    );
}
