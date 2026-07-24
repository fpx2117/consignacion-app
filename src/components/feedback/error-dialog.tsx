"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
}

export function ErrorDialog({
  open,
  onOpenChange,
  title,
  description,
}: ErrorDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="
        fixed left-[50%] top-[50%] z-[9999] 
        translate-x-[-50%] translate-y-[-50%] 
        w-[90%] sm:max-w-[425px] 
        gap-0 p-0 
        border border-[color:var(--status-danger)] dark:border-[color:var(--status-danger)]/20 
        bg-background/95 dark:bg-background/95 
        shadow-2xl backdrop-blur-xl rounded-2xl sm:rounded-3xl 
        overflow-hidden duration-200
      "
      >
        {/* Header con gradiente Rojo */}
        <div className="bg-gradient-to-b from-[color:var(--status-danger)]/5 to-transparent p-8 pb-6 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--status-danger)] dark:bg-[color:var(--status-danger)]/10 ring-8 ring-[color:var(--status-danger)]/5 dark:ring-[color:var(--status-danger)]/10 mb-6 animate-in zoom-in-50 duration-300">
            <AlertCircle className="h-10 w-10 text-[color:var(--status-danger)] dark:text-[color:var(--status-danger)]" />
          </div>

          {/* AQUÍ ESTÁ EL CAMBIO: sm:text-center para forzarlo en desktop */}
          <AlertDialogHeader className="space-y-2 text-center sm:text-center">
            <AlertDialogTitle className="text-2xl font-bold text-center sm:text-center text-foreground tracking-tight">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center sm:text-center text-muted-foreground text-base px-2">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <AlertDialogFooter className="p-6 pt-2 w-full">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full h-12 rounded-xl bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)] font-semibold shadow-lg shadow-red-500/20 dark:shadow-red-900/20 transition-all"
          >
            Entendido, voy a revisar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
