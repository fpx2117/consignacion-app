"use client";

// Formulario estructurado y tipado para los atributos fijos del rubro activo
// (src/modules/invoices/config/rubro-atributos.ts). Complementa, no reemplaza,
// a AtributosExtraEditor: los atributos fijos se muestran acá, visibles por
// default; cualquier otra clave que no esté en el catálogo del rubro sigue
// yendo al editor libre.

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AtributoFijoDef } from "@/modules/invoices/config/rubro-atributos";

interface AtributosFijosFormProps {
  definiciones: AtributoFijoDef[];
  valores: Record<string, string> | null;
  onChange: (clave: string, valor: string) => void;
  errores?: string[];
  disabled?: boolean;
}

export function AtributosFijosForm({
  definiciones,
  valores,
  onChange,
  errores = [],
  disabled,
}: AtributosFijosFormProps) {
  if (definiciones.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {definiciones.map((def) => {
          const valor = valores?.[def.clave] ?? "";
          return (
            <div key={def.clave} className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                {def.label}
                {def.requerido && <span className="text-destructive"> *</span>}
              </Label>
              {def.tipo === "seleccion" ? (
                <Select
                  value={valor}
                  onValueChange={(v) => onChange(def.clave, v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-10 bg-muted/30">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(def.opciones ?? []).map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={
                    def.tipo === "numero"
                      ? "number"
                      : def.tipo === "fecha"
                        ? "date"
                        : "text"
                  }
                  value={valor}
                  onChange={(e) => onChange(def.clave, e.target.value)}
                  disabled={disabled}
                  className="h-10 bg-muted/30"
                />
              )}
            </div>
          );
        })}
      </div>
      {errores.length > 0 && (
        <ul className="space-y-0.5 text-xs text-destructive">
          {errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
