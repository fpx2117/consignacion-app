"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Plus, Loader2, User, Phone, MapPin, Building2, Save } from "lucide-react";

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
import { apiService } from "@/lib/apiService";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface CreateClienteDialogProps {
  onCreated: () => void;
  trigger?: React.ReactNode;
}

export function CreateClienteDialog({ onCreated, trigger }: CreateClienteDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  type FormValues = { nombre: string; telefono: string; direccion: string };
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      nombre: "",
      telefono: "",
      direccion: "",
    }
  });

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      await apiService.createCliente({ nombre: data.nombre, telefono: data.telefono || null, direccion: data.direccion || null });
      toast.success("Cliente creado correctamente");
      setOpen(false);
      reset();
      onCreated();
    } catch (error) {
      console.error(error);
      toast.error("Error al crear el cliente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-primary text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-all">
            <Plus className="mr-2 h-4 w-4 stroke-[3]" /> Nuevo Cliente
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] border-border/50 bg-background/95 backdrop-blur-xl p-0 gap-0 shadow-2xl rounded-[2rem] overflow-hidden">
        {/* Header Visual */}
        <div className="bg-muted/30 p-6 pb-8 border-b border-border/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <User className="w-24 h-24 rotate-12" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary shadow-inner">
              <Plus className="w-6 h-6 stroke-[3]" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Nuevo Cliente
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-muted-foreground/80">
              Agrega un nuevo contacto a tu base de datos.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col"
          autoComplete="off"
        >
          <div className="p-6 space-y-5">
            {/* Sección Personal */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                <User className="w-3 h-3" /> Información Personal
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="nombre" className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors">
                  Nombre Completo <span className="text-[color:var(--status-danger)]">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="nombre"
                    {...register("nombre", { required: "El nombre es obligatorio" })}
                    placeholder="Ej. Juan Pérez"
                    className="pl-10 h-11 bg-muted/40 border-border/50 hover:bg-muted/70 focus:bg-background transition-all rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50"
                  />
                </div>
                {errors.nombre && <span className="text-xs text-[color:var(--status-danger)] ml-1 font-medium">{errors.nombre.message as string}</span>}
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Sección Contacto */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                <Building2 className="w-3 h-3" /> Datos de Contacto
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 group">
                  <Label htmlFor="telefono" className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors">
                    Teléfono
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="telefono"
                      {...register("telefono")}
                      placeholder="WA / Celular"
                      className="pl-10 h-11 bg-muted/40 border-border/50 hover:bg-muted/70 focus:bg-background transition-all rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-2 group">
                  <Label htmlFor="direccion" className="text-xs font-medium ml-1 group-focus-within:text-primary transition-colors">
                    Dirección
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="direccion"
                      {...register("direccion")}
                      placeholder="Ubicación"
                      className="pl-10 h-11 bg-muted/40 border-border/50 hover:bg-muted/70 focus:bg-background transition-all rounded-xl focus-visible:ring-primary/20 focus-visible:border-primary/50"
                    />
                  </div>
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
                  <Save className="mr-2 h-4 w-4" /> Guardar Cliente
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}