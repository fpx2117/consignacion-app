"use client";

import * as React from "react";
import type { Cliente, UpdateClienteInput } from "@/lib/types";
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
import { Badge } from "@/components/ui/badge";

// Iconos
import { 
  Pencil, 
  User, 
  Phone, 
  MapPin, 
  Loader2, 
  Power, 
  CheckCircle2, 
  XCircle 
} from "lucide-react";

export function EditClienteDialog({
  trigger,
  cliente,
  onUpdated,
}: {
  trigger: React.ReactNode;
  cliente: Cliente;
  onUpdated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Estados locales
  const [nombre, setNombre] = React.useState(cliente.nombre);
  const [telefono, setTelefono] = React.useState(cliente.telefono ?? "");
  const [direccion, setDireccion] = React.useState(cliente.direccion ?? "");
  const [activo, setActivo] = React.useState(cliente.activo);

  // Resetear formulario al abrir o cambiar cliente
  React.useEffect(() => {
    if (open) {
      setNombre(cliente.nombre);
      setTelefono(cliente.telefono ?? "");
      setDireccion(cliente.direccion ?? "");
      setActivo(cliente.activo);
    }
  }, [open, cliente]);

  const canSubmit = nombre.trim().length >= 2;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;
    
    setSaving(true);
    try {
      const payload: UpdateClienteInput = {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
        activo,
      };
      
      await apiService.updateCliente(cliente.id, payload);
      
      setOpen(false);
      onUpdated?.();
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "No se pudo actualizar el cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">
        {/* Header con estilo */}
        <div className="p-6 pb-4 border-b bg-muted/10">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <div className="p-2 bg-secondary rounded-lg text-secondary-foreground">
                <Pencil className="h-5 w-5" />
              </div>
              Editar Cliente
            </DialogTitle>
            <DialogDescription>
              Modificá los datos personales o cambiá el estado del cliente.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={save}>
          <div className="p-6 space-y-6">
            
            {/* Sección Datos */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                  Nombre Completo <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="edit-nombre"
                    value={nombre} 
                    onChange={(e) => setNombre(e.target.value)} 
                    className="pl-9 bg-background"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-telefono" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                    Teléfono
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="edit-telefono"
                      value={telefono} 
                      onChange={(e) => setTelefono(e.target.value)} 
                      className="pl-9 bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-direccion" className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                    Dirección
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="edit-direccion"
                      value={direccion} 
                      onChange={(e) => setDireccion(e.target.value)} 
                      className="pl-9 bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sección Estado */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Power className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Estado del Sistema</span>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[250px]">
                    Desactivar impide crear nuevas operaciones para este cliente.
                  </p>
                </div>

                <Button
                  type="button"
                  variant={activo ? "outline" : "destructive"}
                  onClick={() => setActivo(!activo)}
                  className={`min-w-[110px] gap-2 ${activo ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}`}
                >
                  {activo ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Activo
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" /> Inactivo
                    </>
                  )}
                </Button>
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
                className="w-full sm:w-auto min-w-[120px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}