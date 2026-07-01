"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Plus, Loader2, Truck, Hash, Building2, Save, Coins } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiService } from "@/lib/apiService";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface CreateProveedorDialogProps {
  onCreated: () => void;
  trigger?: React.ReactNode;
}

export function CreateProveedorDialog({ onCreated, trigger }: CreateProveedorDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [moneda, setMoneda] = React.useState("ARS");

  type FormValues = { nombre: string; cuit: string };
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      nombre: "",
      cuit: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      await apiService.createProveedor({
        nombre: data.nombre,
        cuit: data.cuit || undefined,
        monedaPreferida: moneda,
      });
      toast.success("Proveedor creado correctamente");
      setOpen(false);
      reset();
      setMoneda("ARS");
      onCreated();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al crear el proveedor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-primary text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-all">
            <Plus className="mr-2 h-4 w-4 stroke-[3]" /> Nuevo Proveedor
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] border-border/50 bg-background/95 backdrop-blur-xl p-0 gap-0 shadow-2xl rounded-[2rem] overflow-hidden">
        {/* Header Visual */}
        <div className="bg-muted/30 p-6 pb-8 border-b border-border/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Truck className="w-24 h-24 rotate-12" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary shadow-inner">
              <Plus className="w-6 h-6 stroke-[3]" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Nuevo Proveedor
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-muted-foreground/80">
              Agrega un nuevo proveedor a tu base de datos.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col"
          autoComplete="off"
        >
          <div className="p-6 space-y-5">
            {/* Sección Identificación */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                <Building2 className="w-3 h-3" /> Identificación
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="nombre" className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors">
                  Nombre / Razón Social <span className="text-[color:var(--status-danger)]">*</span>
                </Label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="nombre"
                    {...register("nombre", { required: "El nombre es obligatorio", minLength: { value: 2, message: "Mínimo 2 caracteres" } })}
                    placeholder="Ej. Distribuidora del Sur S.A."
                    className="pl-10 h-11 bg-muted/40 border-border/50 hover:bg-muted/70 focus:bg-background transition-all rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50"
                  />
                </div>
                {errors.nombre && <span className="text-xs text-[color:var(--status-danger)] ml-1 font-medium">{errors.nombre.message as string}</span>}
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Sección Datos fiscales */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                <Hash className="w-3 h-3" /> Datos Fiscales
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 group">
                  <Label htmlFor="cuit" className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors">
                    CUIT
                  </Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="cuit"
                      {...register("cuit")}
                      placeholder="30-12345678-9"
                      className="pl-10 h-11 bg-muted/40 border-border/50 hover:bg-muted/70 focus:bg-background transition-all rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="moneda" className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors">
                    Moneda Preferida
                  </Label>
                  <Select value={moneda} onValueChange={setMoneda}>
                    <SelectTrigger
                      id="moneda"
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
          </div>

          <DialogFooter className="p-6 pt-2 bg-muted/10 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl h-11 border-border/50 hover:bg-muted/50 font-medium"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl h-11 px-6 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Guardar Proveedor
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
