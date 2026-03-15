"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Globe, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TimezoneMigrationDialog } from "@/components/timezone-migration-dialog";
import { TimezoneSelector } from "@/components/timezone-selector";
import { apiService } from "@/lib/apiService";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TablaInfo = {
  tabla:            string;
  columna:          string;
  registros:        number;
  sample_stored:    string | null;
  sample_corrected: string | null;
};

type MigrationStatus = {
  serverTz:              string;
  configuredTz:          string;
  offsetHours:           number;
  needsMigration:        boolean;
  timezoneMigrationDone: boolean;
  tablas:                TablaInfo[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type GeneralConfig = {
  zonaHoraria?: string | null;
};

// ─── Página ──────────────────────────────────────────────────────────────────

export default function GeneralSettingsPage() {
  const router = useRouter();
  const [migrationStatus, setMigrationStatus] = React.useState<MigrationStatus | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const [zonaHoraria, setZonaHoraria] = React.useState("America/Argentina/Buenos_Aires");
  const [loadingConfig, setLoadingConfig] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Cargar configuración y estado de migración al montar
  React.useEffect(() => {
    const fetchMigrationStatus = async () => {
      try {
        const res = await fetch("/api/admin/timezone-migration");
        if (!res.ok) return;
        const json = (await res.json()) as { data: MigrationStatus };
        setMigrationStatus(json.data);
      } catch {
        // No bloquear la página si falla
      }
    };

    const fetchConfig = async () => {
      try {
        const res = await apiService.getConfiguracionGeneral();
        const config = (
          res && typeof res === "object" && "data" in res ? res.data : res
        ) as GeneralConfig | null;
        if (config?.zonaHoraria) {
          setZonaHoraria(config.zonaHoraria);
        }
      } catch {
        // silently ignore
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchMigrationStatus();
    fetchConfig();
  }, []);

  const handleMigrationSuccess = () => {
    setDialogOpen(false);
    // Refrescar estado
    setMigrationStatus((prev) =>
      prev ? { ...prev, needsMigration: false, timezoneMigrationDone: true } : prev
    );
  };

  const handleSaveTimezone = async () => {
    setSaving(true);
    try {
      await apiService.actualizarConfiguracionGeneral({ zonaHoraria });
      toast.success("Zona horaria actualizada correctamente.");
    } catch {
      toast.error("Error al guardar la zona horaria.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-10 text-foreground">
      {/* Header */}
      <header className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground -ml-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Configuración
        </Button>

        <div className="flex items-center gap-2 text-primary font-semibold tracking-wider uppercase text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20">
          <Settings2 className="h-3 w-3" />
          Configuración General
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
          Configuración General
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Parámetros generales de la plataforma, zona horaria y mantenimiento de datos.
        </p>
      </header>

      {/* Banner de migración de timezone */}
      {migrationStatus?.needsMigration && (
        <Alert className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-300 font-semibold">
            Fechas con offset incorrecto detectadas
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-400">
            <span>
              Se detectaron {migrationStatus.tablas.reduce((s, t) => s + t.registros, 0).toLocaleString()} registros con{" "}
              {migrationStatus.offsetHours}h de adelanto respecto a la zona horaria configurada (
              {migrationStatus.configuredTz}).
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 ml-2 font-semibold text-yellow-800 dark:text-yellow-300 underline underline-offset-2"
              onClick={() => setDialogOpen(true)}
            >
              Revisar y corregir
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ── ZONA HORARIA ─────────────────────────────────────────── */}
      <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
        <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
          <div className="p-2 bg-primary/5 rounded-xl border border-primary/15">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base sm:text-lg tracking-tight">Zona Horaria</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Define cómo se muestran las fechas en tickets, remitos, gastos e inventario.
            </p>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {loadingConfig ? (
            <div className="flex items-center gap-3 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando configuración...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">
                Zona horaria del negocio
              </label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Seleccioná la zona horaria de tu sucursal. Afecta la visualización de
                fechas en tickets de venta, remitos, gastos e inventario.
              </p>
              <div className="max-w-md">
                <TimezoneSelector
                  value={zonaHoraria}
                  onChange={setZonaHoraria}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end border-t border-border/30 pt-5">
            <Button
              onClick={handleSaveTimezone}
              disabled={saving || loadingConfig}
              className="rounded-xl px-6 gap-2 h-10 sm:h-11"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Zona Horaria"
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Contenido de configuración general */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-6 space-y-4">
        <h2 className="text-lg font-bold">Estado del sistema</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border/40">
            <span className="text-muted-foreground">Zona horaria configurada</span>
            <span className="font-mono font-medium">
              {migrationStatus?.configuredTz ?? "—"}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/40">
            <span className="text-muted-foreground">Servidor PostgreSQL</span>
            <span className="font-mono font-medium">
              {migrationStatus?.serverTz ?? "—"}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Migración de fechas históricas</span>
            <span
              className={
                migrationStatus?.timezoneMigrationDone
                  ? "text-green-600 dark:text-green-400 font-medium"
                  : migrationStatus?.needsMigration
                  ? "text-yellow-600 dark:text-yellow-400 font-medium"
                  : "text-muted-foreground"
              }
            >
              {migrationStatus?.timezoneMigrationDone
                ? "Completada"
                : migrationStatus?.needsMigration
                ? "Pendiente"
                : "No requerida"}
            </span>
          </div>
        </div>
      </div>

      {/* Dialog de migración */}
      {migrationStatus && (
        <TimezoneMigrationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          migrationData={migrationStatus}
          onSuccess={handleMigrationSuccess}
        />
      )}
    </div>
  );
}
