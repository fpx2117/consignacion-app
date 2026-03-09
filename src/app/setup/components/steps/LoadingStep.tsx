"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { StepWrapper } from "../StepWrapper";

const LOADING_MESSAGES = [
  "Inicializando bases de datos...",
  "Creando tu perfil de administrador...",
  "Configurando sucursal y terminal...",
  "Aplicando reglas del punto de venta...",
  "Estableciendo preferencias de alertas...",
  "Construyendo el ecosistema empresarial...",
  "Enlazando conexiones seguras...",
  "Ya casi estamos listos...",
];

export function LoadingStep() {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <StepWrapper className="flex flex-col items-center justify-center space-y-8 h-[60vh]">
      {/* Spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        className="relative w-24 h-24"
      >
        <div className="absolute inset-0 rounded-full border-t-4 border-violet-500 opacity-20" />
        <div className="absolute inset-0 rounded-full border-t-4 border-violet-500 blur-sm" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      </motion.div>

      {/* Rotating text */}
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
            {LOADING_MESSAGES[textIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress shimmer */}
      <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="h-full w-1/2 bg-gradient-to-r from-transparent via-violet-500 to-transparent"
        />
      </div>
    </StepWrapper>
  );
}
