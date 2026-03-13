/* eslint-disable */
// @ts-nocheck
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
import { Separator } from "@/components/ui/separator";

// Iconos
import {
  Pencil,
  User,
  Phone,
  MapPin,
  Loader2,
  Power,
  CheckCircle2,
  XCircle,
  Building2,
  Save,
  Trash2
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

      <DialogContent className="sm:max-w-[500px] border-border/50 bg-background/95 backdrop-blur-xl p-0 gap-0 shadow-2xl rounded-[2rem] overflow-hidden">
        {/* Header Visual */}
        <div className="bg-muted/30 p-6 pb-8 border-b border-border/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Pencil className="w-24 h-24 rotate-12" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-4 text-secondary-foreground shadow-inner">
              <Pencil className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
              Editar Cliente
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-muted-foreground/80">
              Modificá los datos personales o cambiá el estado.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={save} className="flex flex-col">
          <div className="p-6 space-y-5">

            {/* Sección Datos */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                <User className="w-3 h-3" /> Información Personal
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="edit-nombre" className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors">
                  Nombre Completo <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="edit-nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="pl-10 h-11 bg-muted/40 border-border/50 hover:bg-muted/70 focus:bg-background transition-all rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 group">
                  <Label htmlFor="edit-telefono" className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors">
                    Teléfono
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="edit-telefono"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="pl-10 h-11 bg-muted/40 border-border/50 hover:bg-muted/70 focus:bg-background transition-all rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="edit-direccion" className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors">
                    Dirección
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="edit-direccion"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      className="pl-10 h-11 bg-muted/40 border-border/50 hover:bg-muted/70 focus:bg-background transition-all rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Sección Estado */}
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Power className={`h-4 w-4 ${activo ? "text-[color:var(--status-success-strong)]" : "text-muted-foreground"}`} />
                    <span className="font-semibold text-sm">Estado del Cliente</span>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[250px]">
                    {activo ? "El cliente puede realizar operaciones." : "Cliente inactivo. No podrá operar."}
                  </p>
                </div>

                <Button
                  type="button"
                  variant={activo ? "outline" : "destructive"}
                  onClick={() => setActivo(!activo)}
                  size="sm"
                  className={`min-w-[100px] h-9 gap-2 transition-all ${activo ? "border-[color:var(--status-success-strong)]/30 bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)]/20 hover:text-[color:var(--status-success-strong)]" : "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"}`}
                >
                  {activo ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Activo
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5" /> Inactivo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 bg-muted/10 flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="rounded-xl h-11 border-border/50 hover:bg-muted/50 font-medium w-full sm:w-auto"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={!canSubmit || saving}
              className="rounded-xl h-11 px-6 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-[0.98] w-full sm:w-auto min-w-[140px]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}