"use client";

import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const loadingTextStates = [
    "Inicializando bases de datos...",
    "Generando perfil de administrador...",
    "Construyendo el ecosistema empresarial...",
    "Estableciendo configuraciones seguras...",
    "Enlazando conexiones...",
    "Ya casi estamos listos..."
];

export function LoadingStep() {
    const [textIndex, setTextIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTextIndex((prev) => (prev + 1) % loadingTextStates.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center space-y-8 h-[60vh]"
        >
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                className="relative w-24 h-24"
            >
                <div className="absolute inset-0 rounded-full border-t-4 border-[color:var(--primary)] opacity-20" />
                <div className="absolute inset-0 rounded-full border-t-4 border-[color:var(--primary)] blur-sm" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[color:var(--primary)] animate-spin" />
                </div>
            </motion.div>

            <div className="h-12 flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={textIndex}
                        initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                        transition={{ duration: 0.4 }}
                        className="text-xl font-bold tracking-tight text-foreground/80 text-center"
                    >
                        {loadingTextStates[textIndex]}
                    </motion.p>
                </AnimatePresence>
            </div>

            <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                    className="h-full w-1/2 bg-gradient-to-r from-transparent via-[color:var(--primary)] to-transparent"
                />
            </div>
        </motion.div>
    );
}
