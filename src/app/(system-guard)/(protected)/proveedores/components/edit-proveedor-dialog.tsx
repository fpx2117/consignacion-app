"use client";

import * as React from "react";
import type { Proveedor, UpdateProveedorInput } from "@/lib/apiService";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import {
  Pencil,
  Truck,
  Hash,
  Coins,
  Loader2,
  Power,
  CheckCircle2,
  XCircle,
  Save,
} from "lucide-react";

export function EditProveedorDialog({
  trigger,
  proveedor,
  onUpdated,
}: {
  trigger: React.ReactNode;
  proveedor: Proveedor;
  onUpdated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [nombre, setNombre] = React.useState(proveedor.nombre);
  const [cuit, setCuit] = React.useState(proveedor.cuit ?? "");
  const [moneda, setMoneda] = React.useState(proveedor.monedaPreferida);
  const [activo, setActivo] = React.useState(proveedor.activo);

  React.useEffect(() => {
    if (open) {
      setNombre(proveedor.nombre);
      setCuit(proveedor.cuit ?? "");
      setMoneda(proveedor.monedaPreferida);
      setActivo(proveedor.activo);
    }
  }, [open, proveedor]);

  const canSubmit = nombre.trim().length >= 2;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    try {
      const payload: UpdateProveedorInput = {
        nombre: nombre.trim(),
        cuit: cuit.trim() || undefined,
        monedaPreferida: moneda,
        activo,
      };

      await apiService.updateProveedor(proveedor.id, payload);

      setOpen(false);
      onUpdated?.();
    } catch (err: unknown) {
      console.error(err);
      alert(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el proveedor",
      );
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
              Editar Proveedor
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-muted-foreground/80">
              Modificá los datos o cambiá el estado del proveedor.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={save} className="flex flex-col">
          <div className="p-6 space-y-5">
            {/* Sección Datos */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                <Truck className="w-3 h-3" /> Información del Proveedor
              </div>

              <div className="space-y-2 group">
                <Label
                  htmlFor="edit-nombre"
                  className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors"
                >
                  Nombre / Razón Social{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
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
                  <Label
                    htmlFor="edit-cuit"
                    className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors"
                  >
                    CUIT
                  </Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="edit-cuit"
                      value={cuit}
                      onChange={(e) => setCuit(e.target.value)}
                      className="pl-10 h-11 bg-muted/40 border-border/50 hover:bg-muted/70 focus:bg-background transition-all rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label
                    htmlFor="edit-moneda"
                    className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors"
                  >
                    Moneda Preferida
                  </Label>
                  <Select value={moneda} onValueChange={setMoneda}>
                    <SelectTrigger
                      id="edit-moneda"
                      className="h-11 bg-muted/40 border-border/50 hover:bg-muted/70 transition-all rounded-xl w-full"
                    >
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ARS">ARS — Peso Argentino</SelectItem>
                      <SelectItem value="USD">USD — Dólar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Sección Estado */}
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Power
                      className={`h-4 w-4 ${activo ? "text-[color:var(--status-success-strong)]" : "text-muted-foreground"}`}
                    />
                    <span className="font-semibold text-sm">
                      Estado del Proveedor
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[250px]">
                    {activo
                      ? "El proveedor está activo y disponible."
                      : "Proveedor inactivo. No aparecerá en las listas."}
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
