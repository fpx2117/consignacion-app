"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Building2, Phone, MapPin, Upload, Palette, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StepWrapper } from "../StepWrapper";
import type { BrandingData } from "../../types";

interface BusinessStepProps {
  businessName: string;
  branding: BrandingData;
  onBusinessNameChange: (value: string) => void;
  onBrandingChange: (value: BrandingData) => void;
}

const COLOR_PRESETS = [
  "#6d28d9", // Violet
  "#2563eb", // Blue
  "#059669", // Emerald
  "#dc2626", // Red
  "#ea580c", // Orange
  "#d97706", // Amber
  "#0891b2", // Cyan
  "#7c3aed", // Purple
  "#db2777", // Pink
  "#111827", // Dark
];

export function BusinessStep({
  businessName,
  branding,
  onBusinessNameChange,
  onBrandingChange,
}: BusinessStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return; // Max 5MB silently
    const preview = URL.createObjectURL(file);
    onBrandingChange({ ...branding, logoFile: file, logoPreview: preview });
  };

  const handleRemoveLogo = () => {
    if (branding.logoPreview) URL.revokeObjectURL(branding.logoPreview);
    onBrandingChange({ ...branding, logoFile: null, logoPreview: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <StepWrapper>
      {/* Header */}
      <div className="space-y-4 text-center mb-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mx-auto"
        >
          <Building2 className="w-8 h-8 text-violet-500" />
        </motion.div>
        <h2 className="text-3xl font-black tracking-tight">Construyamos tu marca</h2>
        <p className="text-muted-foreground text-lg">
          Datos básicos de tu negocio. Aparecerán en tickets, reportes y catálogo.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6 bg-card/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-border/50 shadow-2xl relative">
        <div className="absolute inset-0 bg-violet-500/5 blur-3xl -z-10 rounded-full" />

        {/* Business Name */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2">
            Nombre del Negocio <span className="text-red-400">*</span>
          </Label>
          <Input
            autoFocus
            value={businessName}
            onChange={(e) => onBusinessNameChange(e.target.value)}
            placeholder="Ej: Mega Store S.A."
            className="h-14 rounded-2xl bg-background/50 border-border/50 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 text-lg font-semibold"
          />
        </div>

        {/* Phone + Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2 flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> Teléfono
            </Label>
            <Input
              value={branding.phone}
              onChange={(e) => onBrandingChange({ ...branding, phone: e.target.value })}
              placeholder="+54 351 123 4567"
              className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Dirección
            </Label>
            <Input
              value={branding.address}
              onChange={(e) => onBrandingChange({ ...branding, address: e.target.value })}
              placeholder="Av. Siempreviva 742"
              className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
            />
          </div>
        </div>

        {/* Logo Upload + Color */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Logo */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2 flex items-center gap-1.5">
              <Upload className="h-3 w-3" /> Logo del Negocio
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoSelect}
              className="hidden"
            />
            {branding.logoPreview ? (
              <div className="relative h-28 rounded-2xl border border-border/50 bg-background/30 flex items-center justify-center overflow-hidden group">
                <img
                  src={branding.logoPreview}
                  alt="Logo preview"
                  className="max-h-20 max-w-[80%] object-contain"
                />
                <button
                  onClick={handleRemoveLogo}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-28 rounded-2xl border-dashed border-2 border-border/50 hover:border-violet-500/50 hover:bg-violet-500/5 flex flex-col items-center justify-center gap-2 transition-all"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">
                  Click para subir (máx 5MB)
                </span>
              </Button>
            )}
          </div>

          {/* Color primario */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-widest text-foreground/80 pl-2 flex items-center gap-1.5">
              <Palette className="h-3 w-3" /> Color Principal
            </Label>
            <div className="h-28 rounded-2xl border border-border/50 bg-background/30 p-4 flex flex-col justify-between">
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onBrandingChange({ ...branding, primaryColor: color })}
                    className="h-7 w-7 rounded-lg border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: branding.primaryColor === color ? "white" : "transparent",
                      boxShadow: branding.primaryColor === color ? `0 0 12px ${color}80` : "none",
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => onBrandingChange({ ...branding, primaryColor: e.target.value })}
                  className="h-7 w-7 rounded-lg border-0 bg-transparent cursor-pointer"
                />
                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                  {branding.primaryColor}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-muted-foreground/60 font-medium mt-6">
        Solo el nombre es obligatorio. El resto lo podés completar después en Configuración.
      </p>
    </StepWrapper>
  );
}
