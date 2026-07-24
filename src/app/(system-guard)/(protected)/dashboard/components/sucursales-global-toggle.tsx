"use client";

import * as React from "react";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { SucursalResumen } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface SucursalesGlobalToggleProps {
  onChanged: () => void;
}

export function SucursalesGlobalToggle({
  onChanged,
}: SucursalesGlobalToggleProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [sucursales, setSucursales] = React.useState<SucursalResumen[]>([]);
  const [savingId, setSavingId] = React.useState<number | null>(null);

  const loadSucursales = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getSucursales();
      setSucursales(data.filter((s) => s.activa));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cargar sucursales",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) loadSucursales();
  }, [open, loadSucursales]);

  const handleToggle = async (sucursal: SucursalResumen, next: boolean) => {
    setSavingId(sucursal.id);
    // Optimista
    setSucursales((prev) =>
      prev.map((s) =>
        s.id === sucursal.id ? { ...s, incluidaEnDashboardGlobal: next } : s,
      ),
    );
    try {
      await apiService.updateSucursal(sucursal.id, {
        incluidaEnDashboardGlobal: next,
      });
      onChanged();
    } catch (err) {
      // Revertir en caso de error
      setSucursales((prev) =>
        prev.map((s) =>
          s.id === sucursal.id ? { ...s, incluidaEnDashboardGlobal: !next } : s,
        ),
      );
      toast.error(
        err instanceof Error ? err.message : "Error al actualizar la sucursal",
      );
    } finally {
      setSavingId(null);
    }
  };

  const excludedCount = sucursales.filter(
    (s) => !s.incluidaEnDashboardGlobal,
  ).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group relative inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:bg-muted/40"
          aria-label="Sucursales incluidas en la vista global"
        >
          <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-3.5 w-3.5" />
            {excludedCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--status-warning)] px-1 text-[9px] font-bold text-white">
                {excludedCount}
              </span>
            )}
          </span>
          <span>Sucursales en Global</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-2xl p-3 border-border/60 shadow-xl"
      >
        <div className="mb-2 space-y-0.5 px-1">
          <p className="text-xs font-bold text-foreground">
            Sucursales en la Vista Global
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Desactivá una sucursal para que no sume en los KPIs, tendencia y top
            productos de &quot;Todas las Sucursales&quot;. Su vista individual
            no cambia.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="space-y-1">
            {sucursales.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition-colors",
                  s.incluidaEnDashboardGlobal
                    ? "bg-transparent"
                    : "bg-muted/40",
                )}
              >
                <span className="truncate text-xs font-medium text-foreground/90">
                  {s.nombre}
                </span>
                <div className="flex items-center gap-2">
                  {savingId === s.id && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                  <Switch
                    size="sm"
                    checked={s.incluidaEnDashboardGlobal}
                    disabled={savingId === s.id}
                    onCheckedChange={(checked) => handleToggle(s, checked)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
