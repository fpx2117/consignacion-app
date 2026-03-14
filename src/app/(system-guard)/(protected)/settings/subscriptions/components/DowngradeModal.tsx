"use client";

import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, ChevronRight, X, UserMinus, PackageMinus, ShieldAlert } from "lucide-react";
import { Portal } from "@/components/ui/portal";

interface DowngradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    newPlanName?: string;
}

export function DowngradeModal({ isOpen, onClose, onConfirm, newPlanName }: DowngradeModalProps) {
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
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[color:var(--status-warning)] via-[color:var(--status-warning)] to-[color:var(--status-warning)]" />

                        <div className="p-8 md:p-10 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="h-14 w-14 rounded-2xl bg-[color:var(--status-warning)]/10 flex items-center justify-center">
                                    <ShieldAlert className="h-8 w-8 text-[color:var(--status-warning)]" />
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
                                    ¿Cambiar al plan {newPlanName}?
                                </h2>
                                <p className="text-muted-foreground font-medium">
                                    Estás eligiendo un plan con menores prestaciones. Por favor, lee atentamente los cambios que se aplicarán:
                                </p>
                            </div>

                            <div className="space-y-4 py-4">
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-[color:var(--status-warning)]/5 border border-[color:var(--status-warning)]/10">
                                    <PackageMinus className="h-5 w-5 text-[color:var(--status-warning)] mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-[color:var(--status-warning)]">Reducción de productos</p>
                                        <p className="text-xs text-[color:var(--status-warning)]/70 font-medium">
                                            Si excedés el nuevo límite, los productos más antiguos se **ocultarán automáticamente**. No se borrarán, pero no podrás verlos ni venderlos.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-[color:var(--status-warning)]/5 border border-[color:var(--status-warning)]/10">
                                    <UserMinus className="h-5 w-5 text-[color:var(--status-warning)] mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-[color:var(--status-warning)]">Límite de usuarios</p>
                                        <p className="text-xs text-[color:var(--status-warning)]/70 font-medium">
                                            Si tenés más empleados de los permitidos, los últimos creados quedarán desactivados temporalmente.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-[color:var(--status-warning)]/5 border border-[color:var(--status-warning)]/10">
                                    <AlertTriangle className="h-5 w-5 text-[color:var(--status-warning)] mt-1 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-[color:var(--status-warning)]">Funcionalidades</p>
                                        <p className="text-xs text-[color:var(--status-warning)]/70 font-medium">
                                            Podrías perder acceso a la gestión de consignaciones o múltiples sucursales según el nuevo plan.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <button
                                    onClick={onConfirm}
                                    className="flex-1 h-14 bg-[color:var(--status-warning)] hover:bg-[color:var(--status-warning)] text-[color:var(--ui-fx-white)] font-black rounded-2xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    Entiendo, proceder al Downgrade
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 h-14 bg-secondary text-secondary-foreground font-bold rounded-2xl hover:bg-secondary/80 transition-all active:scale-[0.98]"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        </Portal>
    );
}
