"use client";

import { useEffect, useRef, useState } from "react";
import { Hash } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type QuantityDialogProps = {
  open: boolean;
  productName: string;
  currentQty: number;
  maxStock: number;
  onConfirm: (newQty: number) => void;
  onClose: () => void;
};

export function QuantityDialog({
  open,
  productName,
  currentQty,
  maxStock,
  onConfirm,
  onClose,
}: QuantityDialogProps) {
  const [value, setValue] = useState(String(currentQty));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar valor cuando se abre el dialog
  useEffect(() => {
    if (open) {
      setValue(String(currentQty));
      // Autofocus + seleccionar todo el texto para edición rápida
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, currentQty]);

  const parsedQty = parseInt(value, 10);
  const isValid = !isNaN(parsedQty) && parsedQty >= 1 && parsedQty <= maxStock;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(parsedQty);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xs" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Hash className="h-4 w-4 text-primary shrink-0" />
            Cantidad
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Nombre del producto */}
          <p className="text-xs text-muted-foreground leading-snug truncate">
            {productName}
          </p>

          {/* Input */}
          <div className="space-y-1.5">
            <Label htmlFor="qty-input" className="text-xs font-medium">
              Unidades{maxStock < 9999 ? ` (máx. ${maxStock})` : ""}
            </Label>
            <Input
              ref={inputRef}
              id="qty-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxStock}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="text-center text-xl font-black tabular-nums h-12 tracking-tight"
            />
            {!isValid && value !== "" && (
              <p className="text-xs text-[color:var(--status-danger)]">
                {parsedQty < 1
                  ? "La cantidad mínima es 1."
                  : `Stock disponible: ${maxStock} u.`}
              </p>
            )}
          </div>

          {/* Atajos rápidos */}
          <div className="flex gap-1.5">
            {[1, 2, 5, 10].filter((n) => n <= maxStock).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue(String(n))}
                className="flex-1 rounded-lg border border-border/60 bg-muted/50 py-1.5 text-xs font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!isValid}
            className="flex-1"
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
