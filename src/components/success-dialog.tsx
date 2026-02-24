"use client";

import * as React from "react";
import { CheckCircle2, FileText, ArrowRight, MessageCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface SuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Acciones
  onConfirm: () => void;
  onCancel: () => void;
  onWhatsApp?: () => void;
  // Textos Personalizables
  title?: string;
  description?: React.ReactNode; // ReactNode permite pasar JSX (texto con negritas, spans, etc.)
  confirmText?: string;
  cancelText?: string;
}

export function SuccessDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title = "¡Operación Exitosa!",
  description = "La operación se ha completado correctamente.",
  confirmText = "Descargar PDF",
  cancelText = "Cerrar",
  onWhatsApp
}: SuccessDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="
        fixed left-[50%] top-[50%] z-[9999] 
        translate-x-[-50%] translate-y-[-50%] 
        w-[90%] sm:max-w-[425px] 
        gap-0 p-0 
        border border-emerald-500/20 
        bg-background/95 dark:bg-[#0a0a0a]/95 
        shadow-2xl backdrop-blur-xl rounded-2xl sm:rounded-3xl 
        overflow-hidden duration-200
      ">

        {/* Header con gradiente adaptativo */}
        <div className="bg-gradient-to-b from-emerald-500/5 to-transparent p-8 pb-6 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100/50 dark:bg-emerald-500/10 ring-8 ring-emerald-500/5 mb-6 animate-in zoom-in-50 duration-300">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-500" />
          </div>

          <AlertDialogHeader className="space-y-2 text-center sm:text-center">
            <AlertDialogTitle className="text-2xl font-bold text-center sm:text-center text-foreground tracking-tight">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center sm:text-center text-muted-foreground text-base">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <AlertDialogFooter className="p-6 pt-2 flex-col sm:flex-row gap-3 sm:space-x-0 w-full justify-center sm:justify-center">
          <Button
            onClick={onCancel}
            variant="ghost"
            className="flex-1 h-12 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
          >
            {cancelText}
          </Button>

          {onWhatsApp && (
            <Button
              onClick={onWhatsApp}
              variant="outline"
              className="flex-1 h-12 rounded-xl border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10 font-medium gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          )}

          <Button
            onClick={onConfirm}
            className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg shadow-emerald-500/20 dark:shadow-emerald-900/20 gap-2 group transition-all"
          >
            <FileText className="h-4 w-4" />
            <span>{confirmText}</span>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}