"use client";

import * as React from "react";
import { Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  closeText?: string;
  children?: React.ReactNode; // Aquí inyectamos el contenido personalizado
}

export function HelpDialog({
  open,
  onOpenChange,
  title = "Información",
  closeText = "Entendido",
  children,
}: HelpDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="
        fixed left-[50%] top-[50%] z-[9999] 
        translate-x-[-50%] translate-y-[-50%] 
        w-[90%] sm:max-w-[425px] 
        gap-0 p-0 
        border border-[color:var(--theme-ocean-primary)] dark:border-[color:var(--theme-ocean-primary)]/20 
        bg-background/95 dark:bg-background/95 
        shadow-2xl backdrop-blur-xl rounded-2xl sm:rounded-3xl 
        overflow-hidden duration-200
      "
      >
        {/* Header con gradiente Azul y Icono */}
        <div className="bg-gradient-to-b from-[color:var(--theme-ocean-primary)]/5 to-transparent p-8 pb-6 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--theme-ocean-primary)] dark:bg-[color:var(--theme-ocean-primary)]/10 ring-8 ring-[color:var(--theme-ocean-primary)]/5 dark:ring-[color:var(--theme-ocean-primary)]/10 mb-6 animate-in zoom-in-50 duration-300">
            <Info className="h-10 w-10 text-[color:var(--theme-ocean-primary)] dark:text-[color:var(--theme-ocean-primary)]" />
          </div>

          <AlertDialogHeader className="space-y-4 text-center w-full">
            <AlertDialogTitle className="text-2xl font-bold text-center text-foreground tracking-tight">
              {title}
            </AlertDialogTitle>

            {/* Renderizamos el contenido dinámico aquí */}
            <AlertDialogDescription asChild>
              <div className="text-center text-muted-foreground text-sm w-full">
                {children}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <AlertDialogFooter className="p-6 pt-2 w-full">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full h-12 rounded-xl bg-[color:var(--theme-ocean-primary)] hover:bg-[color:var(--theme-ocean-primary)] text-[color:var(--ui-fx-white)] font-semibold shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20 transition-all"
          >
            {closeText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
