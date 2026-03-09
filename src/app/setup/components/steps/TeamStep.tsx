"use client";

import { motion } from "framer-motion";
import { Users, UserPlus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StepWrapper } from "../StepWrapper";
import type { StaffMember } from "../../types";

interface TeamStepProps {
  staff: StaffMember[];
  onChange: (staff: StaffMember[]) => void;
}

export function TeamStep({ staff, onChange }: TeamStepProps) {
  const addMember = () => {
    onChange([...staff, { nombre: "", email: "", rol: "EMPLEADO", password: "" }]);
  };

  const removeMember = (index: number) => {
    onChange(staff.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof StaffMember, value: string) => {
    const updated = [...staff];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <StepWrapper maxWidth="2xl">
      {/* Header */}
      <div className="space-y-4 text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-fuchsia-600/10 border border-fuchsia-500/20 flex items-center justify-center mx-auto"
        >
          <Users className="w-8 h-8 text-fuchsia-500" />
        </motion.div>
        <h2 className="text-3xl font-black tracking-tight">Tu Equipo Inicial</h2>
        <p className="text-muted-foreground text-lg">
          Añadí a las personas que trabajarán con vos. Podés omitir este paso y hacerlo más tarde.
        </p>
      </div>

      {/* Staff list */}
      <div className="space-y-4">
        {staff.map((member, index) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            key={index}
            className="flex flex-col sm:flex-row gap-3 items-start sm:items-end p-5 rounded-2xl bg-card/40 backdrop-blur-md border border-border/50 shadow-lg relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-fuchsia-500/5 blur-3xl -z-10 rounded-full" />

            <div className="space-y-1.5 flex-1 w-full">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-foreground/70 pl-1">Nombre</Label>
              <Input
                value={member.nombre}
                onChange={(e) => updateMember(index, "nombre", e.target.value)}
                className="h-11 rounded-xl bg-background/50 border-border/50 focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10"
                placeholder="Empleado"
              />
            </div>
            <div className="space-y-1.5 flex-1 w-full">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-foreground/70 pl-1">Email</Label>
              <Input
                type="email"
                value={member.email}
                onChange={(e) => updateMember(index, "email", e.target.value)}
                className="h-11 rounded-xl bg-background/50 border-border/50 focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10"
                placeholder="email@empleado.com"
              />
            </div>
            <div className="space-y-1.5 flex-1 w-full">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-foreground/70 pl-1">Contraseña</Label>
              <Input
                type="text"
                value={member.password || ""}
                onChange={(e) => updateMember(index, "password", e.target.value)}
                className="h-11 rounded-xl bg-background/50 border-border/50 focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10"
                placeholder="(Opcional)"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-xl shrink-0"
              onClick={() => removeMember(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </motion.div>
        ))}

        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button
            variant="outline"
            onClick={addMember}
            className="w-full h-14 rounded-2xl border-dashed border-2 hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5 text-fuchsia-600 font-bold tracking-wide"
          >
            <UserPlus className="w-5 h-5 mr-3" /> Añadir Miembro del Equipo
          </Button>
        </motion.div>

        {staff.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground/50 italic">
              No agregaste empleados todavía. Podés hacerlo después desde Configuración → Seguridad.
            </p>
          </div>
        )}
      </div>
    </StepWrapper>
  );
}
