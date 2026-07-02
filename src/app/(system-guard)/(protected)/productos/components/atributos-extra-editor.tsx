"use client";

// Editor genérico de pares clave-valor para Producto.atributosExtra /
// FacturaProveedorItem.atributosExtra — compartido por create-producto-dialog
// y edit-producto-dialog. Deliberadamente sin campos fijos por rubro: las
// "sugerencias" son solo placeholders/autocomplete (datalist), nunca
// validación — el usuario puede escribir cualquier clave.

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Fila {
  clave: string;
  valor: string;
}

interface AtributosExtraEditorProps {
  value: Record<string, string> | null;
  onChange: (value: Record<string, string> | null) => void;
  /** Claves sugeridas (ej. desde RUBRO_ATRIBUTOS_TIPICOS del rubro configurado) — autocomplete, no validación. */
  sugerencias?: string[];
  disabled?: boolean;
  datalistId?: string;
}

function filasAObjeto(filas: Fila[]): Record<string, string> | null {
  const obj: Record<string, string> = {};
  for (const f of filas) {
    const clave = f.clave.trim();
    if (clave) obj[clave] = f.valor;
  }
  return Object.keys(obj).length > 0 ? obj : null;
}

export function AtributosExtraEditor({
  value,
  onChange,
  sugerencias = [],
  disabled,
  datalistId = "atributos-extra-sugerencias",
}: AtributosExtraEditorProps) {
  const [filas, setFilas] = React.useState<Fila[]>(() =>
    Object.entries(value ?? {}).map(([clave, valor]) => ({ clave, valor }))
  );

  const actualizarFila = (index: number, cambios: Partial<Fila>) => {
    const nuevas = filas.map((f, i) => (i === index ? { ...f, ...cambios } : f));
    setFilas(nuevas);
    onChange(filasAObjeto(nuevas));
  };

  const agregarFila = () => {
    setFilas([...filas, { clave: "", valor: "" }]);
  };

  const quitarFila = (index: number) => {
    const nuevas = filas.filter((_, i) => i !== index);
    setFilas(nuevas);
    onChange(filasAObjeto(nuevas));
  };

  return (
    <div className="space-y-2">
      {filas.map((fila, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            list={datalistId}
            value={fila.clave}
            onChange={(e) => actualizarFila(i, { clave: e.target.value })}
            placeholder="Clave (ej. talle)"
            disabled={disabled}
            className="flex-1"
          />
          <Input
            value={fila.valor}
            onChange={(e) => actualizarFila(i, { valor: e.target.value })}
            placeholder="Valor"
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => quitarFila(i)}
            disabled={disabled}
            aria-label={`Quitar atributo ${fila.clave || i + 1}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {sugerencias.length > 0 && (
        <datalist id={datalistId}>
          {sugerencias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      <Button type="button" variant="outline" size="sm" onClick={agregarFila} disabled={disabled} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" /> Agregar atributo
      </Button>
    </div>
  );
}
