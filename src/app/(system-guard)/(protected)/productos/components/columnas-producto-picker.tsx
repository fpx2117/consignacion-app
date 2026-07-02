"use client";

// Selector de columnas dinámicas para la tabla de productos (Fase 4 de
// openspec/changes/rubro-contexto-ocr/) — el usuario elige explícitamente
// qué claves de atributosExtra quiere ver como columna. Las candidatas son
// las claves que YA existen en el catálogo cargado (dato real) más las
// sugeridas por el rubro configurado — nunca detección automática ni
// columnas fijas por rubro (ver Decisión 7 del documento).

import * as React from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ColumnasProductoPickerProps {
  candidatas: string[];
  seleccionadas: string[];
  onChange: (nuevas: string[]) => void;
  disabled?: boolean;
}

export function ColumnasProductoPicker({
  candidatas,
  seleccionadas,
  onChange,
  disabled,
}: ColumnasProductoPickerProps) {
  const toggle = (clave: string) => {
    if (seleccionadas.includes(clave)) {
      onChange(seleccionadas.filter((c) => c !== clave));
    } else {
      onChange([...seleccionadas, clave]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-semibold gap-1.5" disabled={disabled}>
          <Columns3 className="h-3.5 w-3.5" />
          Columnas
          {seleccionadas.length > 0 && (
            <span className="ml-0.5 rounded-full bg-primary/10 text-primary px-1.5 text-[10px] font-bold">
              {seleccionadas.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Mostrar como columna</p>
        {candidatas.length === 0 ? (
          <p className="text-xs text-muted-foreground/70 py-2 leading-relaxed">
            Todavía no hay atributos cargados en tu catálogo. Agregalos desde
            &quot;Atributos adicionales&quot; al crear o editar un producto.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {candidatas.map((clave) => (
              <label key={clave} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={seleccionadas.includes(clave)}
                  onCheckedChange={() => toggle(clave)}
                  disabled={disabled}
                />
                <span className="capitalize">{clave}</span>
              </label>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
