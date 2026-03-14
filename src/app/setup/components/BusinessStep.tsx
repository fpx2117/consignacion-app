"use client";

import { motion } from "motion/react";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BusinessStepProps {
    value: string;
    onChange: (value: string) => void;
    onNext: () => void;
}

export function BusinessStep({ value, onChange, onNext }: BusinessStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl mx-auto space-y-10"
        >
            <div className="space-y-4 text-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 rounded-2xl bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/20 flex items-center justify-center mx-auto mb-6"
                >
                    <Building2 className="w-8 h-8 text-[color:var(--primary)]" />
                </motion.div>
                <h2 className="text-3xl font-black tracking-tight">Construyamos tu marca</h2>
                <p className="text-muted-foreground text-lg">¿Cómo se llama tu empresa o negocio?</p>
            </div>

            <div className="space-y-4 relative group">
                <div className="absolute inset-0 bg-[color:var(--primary)]/5 blur-3xl -z-10 rounded-full transition-opacity opacity-0 group-focus-within:opacity-100" />

                <Label htmlFor="businessName" className="sr-only">Nombre de la Empresa</Label>
                <Input
                    id="businessName"
                    autoFocus
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && value.trim()) onNext();
                    }}
                    placeholder="Ej: Mega Store S.A."
                    className="h-20 text-3xl font-bold text-center rounded-3xl bg-background/50 border-border/50 focus:border-[color:var(--primary)] focus:ring-4 focus:ring-[color:var(--primary)]/10 transition-all placeholder:text-muted/40"
                    autoComplete="off"
                />
            </div>

            <p className="text-center text-xs text-muted-foreground font-medium uppercase tracking-widest mt-8">
                Presiona <kbd className="px-2 py-1 rounded bg-muted font-sans border border-border mx-1 text-foreground/70">Enter</kbd> para continuar
            </p>
        </motion.div>
    );
}
