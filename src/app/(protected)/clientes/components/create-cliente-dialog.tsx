"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { Plus, Loader2, User, Phone, MapPin } from "lucide-react";

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
import { toast } from "sonner"; // O tu librería de notificaciones

interface CreateClienteDialogProps {
  onCreated: () => void;
  trigger?: React.ReactNode;
}

export function CreateClienteDialog({ onCreated, trigger }: CreateClienteDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      nombre: "",
      telefono: "",
      direccion: "",
    }
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await apiService.createCliente({ ...data, activo: true });
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
          <Button className="bg-primary text-primary-foreground font-bold rounded-2xl">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px] rounded-[2.5rem] border-border bg-background p-8 shadow-2xl">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter text-foreground">
            Nuevo Registro
          </DialogTitle>
          <DialogDescription className="text-muted-foreground font-medium">
            Ingresa los datos del nuevo cliente para el sistema.
          </DialogDescription>
        </DialogHeader>

       <form 
  onSubmit={handleSubmit(onSubmit)} 
  className="space-y-6 py-4"
  autoComplete="off" // Desactiva el autocompletado a nivel formulario
>
  {/* Campo Nombre */}
  <div className="space-y-2">
    <Label htmlFor="nombre" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
      Nombre Completo
    </Label>
    <div className="relative">
      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id="nombre"
        {...register("nombre", { required: "El nombre es obligatorio" })}
        placeholder="Ej. Juan Pérez"
        autoComplete="one-time-code" // Técnica para forzar al navegador a ignorar el historial
        className="pl-10 h-12 bg-muted/50 border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary"
      />
    </div>
  </div>

  {/* Campo Teléfono */}
  <div className="space-y-2">
    <Label htmlFor="telefono" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
      Teléfono / WhatsApp
    </Label>
    <div className="relative">
      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id="telefono"
        {...register("telefono")}
        placeholder="Ej. 11 2345 6789"
        autoComplete="off"
        className="pl-10 h-12 bg-muted/50 border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary"
      />
    </div>
  </div>

  {/* Campo Dirección */}
  <div className="space-y-2">
    <Label htmlFor="direccion" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
      Ubicación / Dirección
    </Label>
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        id="direccion"
        {...register("direccion")}
        placeholder="Ej. Av. Siempre Viva 742"
        autoComplete="off"
        className="pl-10 h-12 bg-muted/50 border-border rounded-xl text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary"
      />
    </div>
  </div>
        

          <DialogFooter className="pt-4 flex-col sm:flex-row gap-3">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setOpen(false)}
              className="rounded-xl font-bold uppercase text-[10px] tracking-widest"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="rounded-xl h-12 px-8 bg-primary text-primary-foreground font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                "Guardar Cliente"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}