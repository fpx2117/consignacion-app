"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { Loader2 } from "lucide-react"; // Solo para el estado de carga

// UI Components
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

  async function handleSave() {
    if (!nombre.trim()) return toast.error("El nombre es obligatorio");

    setSaving(true);
    try {
      await apiService.createCategoria({ nombre: nombre.trim() });
      toast.success("Categoría creada con éxito");
      setNombre("");
      setOpen(false);
      onCreated?.();
    } catch (error) {
      toast.error("No se pudo crear la categoría");
    } finally {
      setSaving(false);
    }
  }

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
            <div className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            <DialogTitle className="text-2xl font-black tracking-tighter">
              Nueva Categoría
            </DialogTitle>
          </div>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
            Asigna un nombre para organizar tus productos.
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

          {/* Previsualización del estilo */}
          <div className="p-6 rounded-3xl bg-zinc-900/30 border border-zinc-800 flex flex-col items-center gap-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Previsualización en tabla</span>
            <div className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-white text-zinc-950">
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