"use client";

import * as React from "react";
import type { CreateClienteInput } from "@/lib/types";
import { apiService } from "@/lib/apiService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { User, Phone, MapPin, Loader2 } from "lucide-react";

export function CreateClienteDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Estado inicial del formulario
  const [form, setForm] = React.useState<CreateClienteInput>({
    nombre: "",
    telefono: "", // Inicializado como string vacío para inputs controlados
    direccion: "",
  });

  const canSubmit = form.nombre.trim().length >= 2;

  // Función genérica para actualizar campos
  function update(key: keyof CreateClienteInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    try {
      const payload: CreateClienteInput = {
        nombre: form.nombre.trim(),
        telefono: form.telefono?.trim() || null,
        direccion: form.direccion?.trim() || null,
      };

      await apiService.createCliente(payload);

      setOpen(false);
      setForm({ nombre: "", telefono: "", direccion: "" }); // Reset limpio
      onCreated?.();
    } catch (err: any) {
      console.error(err);
      // Idealmente usarías un componente Toast aquí
      alert(err?.message ?? "No se pudo crear el cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0">
        <div className="p-6 pb-4 border-b bg-muted/10">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="h-5 w-5 text-primary" />
              </div>
              Nuevo Cliente
            </DialogTitle>
            <DialogDescription>
              Ingresá los datos personales del cliente para registrarlo en el sistema.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={onSubmit}>
          <div className="p-6 space-y-5">
            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="nombre" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                Nombre Completo <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => update("nombre", e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="pl-9 bg-background focus-visible:ring-primary/20"
                  autoFocus
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <Label htmlFor="telefono" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                Teléfono
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="telefono"
                  value={form.telefono || ""}
                  onChange={(e) => update("telefono", e.target.value)}
                  placeholder="Ej: 11 2345-6789"
                  className="pl-9 bg-background focus-visible:ring-primary/20"
                  type="tel"
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="direccion" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                Dirección
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="direccion"
                  value={form.direccion || ""}
                  onChange={(e) => update("direccion", e.target.value)}
                  placeholder="Calle, número, localidad"
                  className="pl-9 bg-background focus-visible:ring-primary/20"
                  autoComplete="street-address"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 bg-muted/5 flex-col-reverse sm:flex-row gap-2">
             <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>

              <Button 
                type="submit" 
                disabled={!canSubmit || saving}
                className="w-full sm:w-auto min-w-[140px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Crear Cliente"
                )}
              </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}