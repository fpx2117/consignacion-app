"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { CATEGORY_PALETTE, type CategoryColorKey } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import { Loader2, Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

export function CreateCategoriaDialog({ onCreated, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [nombre, setNombre] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState<CategoryColorKey>("sky");

  async function handleSave() {
    if (!nombre.trim()) return toast.error("El nombre es obligatorio");

    setSaving(true);
    try {
      await apiService.createCategoria({ nombre: nombre.trim(), color: selectedColor });
      toast.success("Categoría creada con éxito");
      setNombre("");
      setSelectedColor("sky");
      setOpen(false);
      onCreated?.();
    } catch (error) {
      toast.error("No se pudo crear la categoría");
    } finally {
      setSaving(false);
    }
  }

  const activeColor = CATEGORY_PALETTE.find((c) => c.key === selectedColor) || CATEGORY_PALETTE[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="rounded-2xl border-zinc-800 font-black uppercase text-[10px] tracking-widest h-12 px-6">
            Nueva Categoría
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="rounded-[2.5rem] bg-zinc-950 border-zinc-800 p-8 max-w-[400px]">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={cn("h-3 w-3 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]", activeColor.dot)} />
            <DialogTitle className="text-2xl font-black tracking-tighter">
              Nueva Categoría
            </DialogTitle>
          </div>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
            Asigna un nombre y color para organizar tus productos.
          </p>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">
              Nombre de Categoría
            </Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Electrónica, Alimentos..."
              className="h-14 bg-zinc-900/50 border-zinc-800 rounded-2xl focus-visible:ring-blue-500/20 focus-visible:border-blue-500/50 text-base font-medium px-5 transition-all"
            />
          </div>

          {/* Color Palette Picker */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-1">
              Color
            </Label>
            <div className="grid grid-cols-6 gap-2 p-3 rounded-2xl bg-zinc-900/50 border border-zinc-800">
              {CATEGORY_PALETTE.map((color) => (
                <button
                  key={color.key}
                  type="button"
                  onClick={() => setSelectedColor(color.key as CategoryColorKey)}
                  className={cn(
                    "relative h-9 w-full rounded-xl transition-all duration-200 flex items-center justify-center",
                    "hover:scale-110 hover:shadow-lg active:scale-95",
                    selectedColor === color.key
                      ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110"
                      : "opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: color.hex }}
                  title={color.label}
                >
                  {selectedColor === color.key && (
                    <Check className="h-4 w-4 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Previsualización */}
          <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-800 flex flex-col items-center gap-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Previsualización en tabla</span>
            <div className={cn("inline-flex items-center justify-center px-5 py-2 rounded-full gap-2 border", activeColor.bg, activeColor.text, activeColor.border)}>
              <div className={cn("h-2 w-2 rounded-full", activeColor.dot)} />
              <span className="text-[11px] font-black uppercase tracking-widest">
                {nombre || "CATEGORÍA"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-2xl font-bold text-zinc-400 hover:bg-zinc-900"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 font-black uppercase text-[11px] tracking-widest h-12 shadow-xl"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}