"use client";

import { motion } from "motion/react";
import { UserCog, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepWrapper } from "../StepWrapper";
import { useState } from "react";
import type { AdminData } from "../../types";

interface AdminStepProps {
  data: AdminData;
  onChange: (data: AdminData) => void;
}

export function AdminStep({ data, onChange }: AdminStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const strengthColor = (strength: number) => {
    if (strength <= 1) return "var(--status-danger)";
    if (strength <= 2) return "var(--status-warning)";
    if (strength <= 3) return "var(--status-success)";
    return "var(--status-success-strong)";
  };

  return (
    <StepWrapper>
      {/* Header */}
      <div className="space-y-4 text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/20 flex items-center justify-center mx-auto"
        >
          <UserCog className="w-8 h-8 text-[color:var(--primary)]" />
        </motion.div>
        <h2 className="text-3xl font-black tracking-tight">
          Tu Perfil de Administrador
        </h2>
        <p className="text-muted-foreground text-lg">
          La llave maestra para controlar todo el ecosistema.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6 bg-card/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-border/50 shadow-2xl relative">
        <div className="absolute inset-0 bg-[color:var(--primary)]/5 blur-3xl -z-10 rounded-full" />

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">
            Tu Nombre{" "}
            <span className="text-[color:var(--status-danger)]">*</span>
          </Label>
          <Input
            autoFocus
            value={data.nombre}
            onChange={(e) => onChange({ ...data, nombre: e.target.value })}
            placeholder="Ej: Juan Pérez"
            className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-[color:var(--primary)] focus:ring-4 focus:ring-[color:var(--primary)]/10 text-lg"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">
            Email Corporativo{" "}
            <span className="text-[color:var(--status-danger)]">*</span>
          </Label>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            placeholder="john@empresa.com"
            className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-[color:var(--primary)] focus:ring-4 focus:ring-[color:var(--primary)]/10 text-lg"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">
              Contraseña{" "}
              <span className="text-[color:var(--status-danger)]">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={data.password}
                onChange={(e) =>
                  onChange({ ...data, password: e.target.value })
                }
                placeholder="Mínimo 6 caracteres"
                className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-[color:var(--primary)] focus:ring-4 focus:ring-[color:var(--primary)]/10 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">
              Confirmar{" "}
              <span className="text-[color:var(--status-danger)]">*</span>
            </Label>
            <Input
              type={showPassword ? "text" : "password"}
              value={data.confirmPassword}
              onChange={(e) =>
                onChange({ ...data, confirmPassword: e.target.value })
              }
              placeholder="Repetí la contraseña"
              className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-[color:var(--primary)] focus:ring-4 focus:ring-[color:var(--primary)]/10"
            />
          </div>
        </div>

        {/* Password strength hint */}
        {data.password && (
          <div className="flex items-center gap-2 px-2">
            <div className="flex-1 flex gap-1">
              {[1, 2, 3, 4].map((level) => {
                const strength = getPasswordStrength(data.password);
                return (
                  <div
                    key={level}
                    className="h-1 flex-1 rounded-full transition-colors"
                    style={{
                      backgroundColor:
                        level <= strength
                          ? strengthColor(strength)
                          : "hsl(var(--muted-foreground) / 0.25)",
                    }}
                  />
                );
              })}
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              {getPasswordLabel(data.password)}
            </span>
          </div>
        )}

        {/* Mismatch warning */}
        {data.confirmPassword && data.password !== data.confirmPassword && (
          <p className="text-xs text-[color:var(--status-danger)] font-medium pl-2">
            Las contraseñas no coinciden
          </p>
        )}
      </div>
    </StepWrapper>
  );
}

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function getPasswordLabel(password: string): string {
  const s = getPasswordStrength(password);
  if (s <= 1) return "Débil";
  if (s <= 2) return "Regular";
  if (s <= 3) return "Buena";
  return "Fuerte";
}
