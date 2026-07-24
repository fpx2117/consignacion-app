"use client";

import * as React from "react";
import type { DescuentoNivel } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Package, Percent, X, BadgePercent } from "lucide-react";

interface DiscountTiersInlineProps {
  descuentos: DescuentoNivel[];
  onChange: (descuentos: DescuentoNivel[]) => void;
}

export function DiscountTiersInline({
  descuentos,
  onChange,
}: DiscountTiersInlineProps) {
  return (
    <div className="rounded-lg border border-border/40 p-3 space-y-2 bg-muted/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BadgePercent
            className={`h-3.5 w-3.5 ${descuentos.length > 0 ? "text-primary" : "text-muted-foreground"}`}
          />
          <span
            className={`text-xs font-semibold ${descuentos.length > 0 ? "text-foreground" : "text-muted-foreground"}`}
          >
            Descuentos {descuentos.length > 0 && `(${descuentos.length})`}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[10px] border-dashed border-primary/40 text-primary hover:bg-primary/5"
          onClick={() =>
            onChange([...descuentos, { cantidadMin: 0, porcentaje: 0 }])
          }
        >
          <Plus className="h-3 w-3 mr-0.5" /> Nivel
        </Button>
      </div>

      {descuentos.length > 0 && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_1fr_28px] gap-1.5 text-[9px] font-bold uppercase text-muted-foreground px-0.5">
            <span>{`Llevando \u2265`}</span>
            <span>Descuento %</span>
            <span />
          </div>
          {descuentos.map((d, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_28px] gap-1.5 items-center"
            >
              <div className="relative">
                <Package className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-primary" />
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={d.cantidadMin || ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    onChange(
                      descuentos.map((item, idx) =>
                        idx === i ? { ...item, cantidadMin: val } : item,
                      ),
                    );
                  }}
                  placeholder="Cant."
                  className="pl-7 h-8 bg-primary/5 border-primary/20 text-xs"
                />
              </div>
              <div className="relative">
                <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-primary" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={d.porcentaje || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    onChange(
                      descuentos.map((item, idx) =>
                        idx === i ? { ...item, porcentaje: val } : item,
                      ),
                    );
                  }}
                  placeholder="%"
                  className="pl-7 h-8 bg-primary/5 border-primary/20 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() =>
                  onChange(descuentos.filter((_, idx) => idx !== i))
                }
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <p className="text-[9px] text-muted-foreground italic">
            Se aplica el mayor descuento que cumpla la cantidad de la
            categor&iacute;a.
          </p>
        </div>
      )}
    </div>
  );
}
