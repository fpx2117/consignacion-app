"use client";

import { motion } from "motion/react";
import { StepWrapper } from "../StepWrapper";

export function SuccessStep() {
  return (
    <StepWrapper className="flex flex-col items-center justify-center text-center space-y-6 h-[50vh]">
      {/* Checkmark */}
      <div className="w-24 h-24 rounded-full bg-[color:var(--status-success)]/20 flex items-center justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-[color:var(--status-success)] flex items-center justify-center shadow-[0_0_50px_10px_rgba(34,197,94,0.4)]">
          <svg
            className="w-8 h-8 text-[color:var(--ui-fx-white)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>

      <h2 className="text-4xl md:text-5xl font-black tracking-tight">
        ¡Todo Listo!
      </h2>
      <p className="text-muted-foreground text-xl">
        Tu ecosistema empresarial ha sido configurado con éxito.
      </p>
      <p className="text-sm font-medium text-foreground/50 animate-pulse pt-4">
        Redirigiendo al panel de control...
      </p>
    </StepWrapper>
  );
}
