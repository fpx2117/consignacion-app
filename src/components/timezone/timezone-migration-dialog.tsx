"use client";

import * as React from "react";
import { AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TablaInfo = {
  tabla:            string;
  columna:          string;
  registros:        number;
  sample_stored:    string | null;
  sample_corrected: string | null;
};

type MigrationData = {
  serverTz:              string;
  configuredTz:          string;
  offsetHours:           number;
  needsMigration:        boolean;
  timezoneMigrationDone: boolean;
  tablas:                TablaInfo[];
};

type DryRunTarget = {
  tabla:   string;
  columna: string;
  updated: number;
};

type DryRunResult = {
  dryRun:    boolean;
  offsetHours: number;
  interval:  string;
  message:   string;
  targets:   DryRunTarget[];
};

interface TimezoneMigrationDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  migrationData: MigrationData;
  onSuccess:     () => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function TimezoneMigrationDialog({
  open,
  onOpenChange,
  migrationData,
  onSuccess,
}: TimezoneMigrationDialogProps) {
  const [confirmed, setConfirmed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [dryRunResult, setDryRunResult] = React.useState<DryRunResult | null>(null);
  const [step, setStep] = React.useState<"diagnostic" | "dryrun-preview" | "done">("diagnostic");

  // Resetear estado al abrir/cerrar
  React.useEffect(() => {
    if (!open) {
      setConfirmed(false);
      setDryRunResult(null);
      setStep("diagnostic");
    }
  }, [open]);

  // ── Paso 1: DRY-RUN ──────────────────────────────────────────────────────
  const handleDryRun = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/timezone-migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: true,
          confirmar: true,
          offsetHours: migrationData.offsetHours,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Error en dry-run");
      }

      const json = (await res.json()) as { data: DryRunResult };
      setDryRunResult(json.data);
      setStep("dryrun-preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error ejecutando el diagnóstico previo");
    } finally {
      setLoading(false);
    }
  };

  // ── Paso 2: EJECUCIÓN REAL ────────────────────────────────────────────────
  const handleApply = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/timezone-migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          confirmar: true,
          offsetHours: migrationData.offsetHours,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Error aplicando la migración");
      }

      setStep("done");
      toast.success("Migración completada. Las fechas históricas fueron corregidas.");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error aplicando la corrección");
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const totalRegistros = migrationData.tablas.reduce((sum, t) => sum + t.registros, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Corrección de fechas históricas
          </DialogTitle>
          <DialogDescription>
            La base de datos tiene{" "}
            <span className="font-semibold text-foreground">{migrationData.offsetHours} horas</span> de
            adelanto respecto a la zona horaria configurada (
            <span className="font-semibold text-foreground">{migrationData.configuredTz}</span>).
            Esta operación ajustará todas las fechas restando ese offset.
          </DialogDescription>
        </DialogHeader>

        {/* ── PASO: Diagnóstico ── */}
        {step === "diagnostic" && (
          <div className="space-y-4">
            {/* Info de offset */}
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Servidor PostgreSQL</span>
                <span className="font-mono font-medium">{migrationData.serverTz}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zona horaria configurada</span>
                <span className="font-mono font-medium">{migrationData.configuredTz}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Offset a corregir</span>
                <span className="font-mono font-medium text-yellow-700 dark:text-yellow-400">
                  -{migrationData.offsetHours}h
                </span>
              </div>
            </div>

            {/* Tabla de diagnóstico */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tabla</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Columna</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Registros</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">
                      Almacenado → Corregido
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {migrationData.tablas.map((t, i) => (
                    <tr
                      key={`${t.tabla}-${t.columna}`}
                      className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{t.tabla}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{t.columna}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.registros.toLocaleString()}</td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        {t.sample_stored && t.sample_corrected ? (
                          <span className="text-xs font-mono text-muted-foreground">
                            <span className="text-destructive">{t.sample_stored}</span>
                            {" → "}
                            <span className="text-green-600 dark:text-green-400">{t.sample_corrected}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">sin datos</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/30">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 font-medium text-sm">Total</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{totalRegistros.toLocaleString()}</td>
                    <td className="hidden md:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Checkbox de confirmación */}
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground leading-snug">
                Entiendo que esta operación modificará los datos de la base de datos de forma permanente
                y que se recomienda tener un backup antes de proceder.
              </span>
            </label>
          </div>
        )}

        {/* ── PASO: Preview DRY-RUN ── */}
        {step === "dryrun-preview" && dryRunResult && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">
                Simulación completada (DRY-RUN)
              </p>
              <p className="text-blue-700 dark:text-blue-400 text-xs">{dryRunResult.message}</p>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tabla</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Columna</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">A modificar</th>
                  </tr>
                </thead>
                <tbody>
                  {dryRunResult.targets.map((t, i) => (
                    <tr
                      key={`${t.tabla}-${t.columna}`}
                      className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{t.tabla}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{t.columna}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{t.updated.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-muted-foreground">
              Al confirmar, se aplicará la corrección de{" "}
              <span className="font-semibold">-{dryRunResult.offsetHours}h</span> a todos los registros
              listados arriba. Esta acción no se puede deshacer.
            </p>
          </div>
        )}

        {/* ── PASO: Éxito ── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-foreground">Migración completada con éxito</p>
            <p className="text-sm text-muted-foreground">
              Todas las fechas históricas fueron corregidas. La base de datos ahora refleja la hora
              correcta de {migrationData.configuredTz}.
            </p>
          </div>
        )}

        {/* ── Footer con acciones ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          {step !== "done" && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          )}

          {step === "diagnostic" && (
            <Button
              onClick={handleDryRun}
              disabled={!confirmed || loading}
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Previsualizar cambios
            </Button>
          )}

          {step === "dryrun-preview" && (
            <Button
              onClick={handleApply}
              disabled={loading}
              variant="destructive"
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Aplicar corrección
            </Button>
          )}

          {step === "done" && (
            <Button onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
