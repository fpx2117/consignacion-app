"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface WelcomeStepProps {
    onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center space-y-8 text-center"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
                className="w-24 h-24 rounded-3xl bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/20 flex items-center justify-center relative"
            >
                <div className="absolute inset-0 bg-[color:var(--primary)]/20 blur-xl rounded-3xl" />
                <Sparkles className="w-10 h-10 text-[color:var(--primary)]" />
            </motion.div>

            <div className="space-y-4 max-w-lg">
                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-4xl md:text-5xl font-black tracking-tight"
                >
                    Bienvenido a tu <span className="text-[color:var(--primary)]">Nuevo Ecosistema</span>.
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-muted-foreground text-lg md:text-xl font-medium"
                >
                    Vamos a configurar tu entorno en unos simples pasos. Te prometemos que será rápido.
                </motion.p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="pt-8"
            >
                <button
                    onClick={onNext}
                    className="px-8 py-4 rounded-full bg-foreground text-background font-black tracking-widest uppercase text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_-10px_var(--tw-shadow-color)] shadow-foreground/30"
                >
                    Comenzar Configuración
                </button>
            </motion.div>
        </motion.div>
    );
}
