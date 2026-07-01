"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Globe, Loader2, Settings2, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TimezoneMigrationDialog } from "@/components/timezone/timezone-migration-dialog";
import { TimezoneSelector } from "@/components/timezone/timezone-selector";
import { apiService } from "@/lib/apiService";
import { TECHNICAL_FALLBACK_TZ } from "@/lib/timezone/timezone-constants";
import type { Configuracion, ProfileTimezone, TimezoneSource } from "@/lib/types";
import { useTimezone } from "@/hooks/useTimezone";

type TablaInfo = {
  tabla: string;
  columna: string;
  registros: number;
  sample_stored: string | null;
  sample_corrected: string | null;
};

type MigrationStatus = {
  serverTz: string;
  configuredTz: string;
  offsetHours: number;
  needsMigration: boolean;
  timezoneMigrationDone: boolean;
  tablas: TablaInfo[];
};

const EMPTY_PROFILE: ProfileTimezone = {
  zonaHoraria: null,
  zonaHorariaSucursal: null,
  zonaHorariaResuelta: TECHNICAL_FALLBACK_TZ,
  timezoneSource: "fallback",
};

function getSourceLabel(source: TimezoneSource) {
  if (source === "user") return "Personal";
  if (source === "branch") return "Sucursal";
  return "Fallback tecnico";
}

export default function GeneralSettingsPage() {
  const router = useRouter();
  const timezone = useTimezone();
  const isAdmin = timezone.role === "ADMIN";

  const [migrationStatus, setMigrationStatus] = React.useState<MigrationStatus | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [profile, setProfile] = React.useState<ProfileTimezone>(EMPTY_PROFILE);
  const [personalDraft, setPersonalDraft] = React.useState(TECHNICAL_FALLBACK_TZ);
  const [branchTimezone, setBranchTimezone] = React.useState(TECHNICAL_FALLBACK_TZ);
  const [loadingPage, setLoadingPage] = React.useState(true);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingBranch, setSavingBranch] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const fetchMigrationStatus = async () => {
      try {
        const res = await fetch("/api/admin/timezone-migration", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { data: MigrationStatus };
        if (!cancelled) setMigrationStatus(json.data);
      } catch {}
    };

    const fetchSettings = async () => {
      try {
        const [profileData, generalConfig] = await Promise.all([
          apiService.getProfileTimezone(),
          isAdmin ? apiService.getConfiguracionGeneral() : Promise.resolve<Configuracion | null>(null),
        ]);

        if (cancelled) return;

        setProfile(profileData ?? EMPTY_PROFILE);
        setPersonalDraft((profileData ?? EMPTY_PROFILE).zonaHoraria ?? (profileData ?? EMPTY_PROFILE).zonaHorariaResuelta);
        setBranchTimezone(
          generalConfig?.zonaHoraria ?? profileData?.zonaHorariaSucursal ?? TECHNICAL_FALLBACK_TZ,
        );
      } catch {
        if (!cancelled) {
          setProfile({
            zonaHoraria: timezone.userTimezone,
            zonaHorariaSucursal: timezone.branchTimezone,
            zonaHorariaResuelta: timezone.resolvedTimezone,
            timezoneSource: timezone.source,
          });
          setPersonalDraft(timezone.userTimezone ?? timezone.resolvedTimezone);
          setBranchTimezone(timezone.branchTimezone ?? TECHNICAL_FALLBACK_TZ);
        }
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    };

    void fetchMigrationStatus();
    void fetchSettings();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, timezone.branchTimezone, timezone.resolvedTimezone, timezone.source, timezone.userTimezone]);

  const resolvedProfile = React.useMemo<ProfileTimezone>(
    () => ({
      zonaHoraria: profile.zonaHoraria ?? timezone.userTimezone ?? null,
      zonaHorariaSucursal: profile.zonaHorariaSucursal ?? timezone.branchTimezone ?? null,
      zonaHorariaResuelta: profile.zonaHorariaResuelta ?? timezone.resolvedTimezone,
      timezoneSource: profile.timezoneSource ?? timezone.source,
    }),
    [profile, timezone.branchTimezone, timezone.resolvedTimezone, timezone.source, timezone.userTimezone],
  );

  const syncProfile = React.useCallback(async () => {
    const [freshProfile] = await Promise.all([apiService.getProfileTimezone(), timezone.refresh()]);
    setProfile(freshProfile);
    setPersonalDraft(freshProfile.zonaHoraria ?? freshProfile.zonaHorariaResuelta);
    return freshProfile;
  }, [timezone]);

  const handleMigrationSuccess = () => {
    setDialogOpen(false);
    setMigrationStatus((prev) =>
      prev ? { ...prev, needsMigration: false, timezoneMigrationDone: true } : prev,
    );
  };

  const handleSaveProfileTimezone = async () => {
    setSavingProfile(true);
    try {
      await apiService.updateProfileTimezone(personalDraft);
      const freshProfile = await syncProfile();
      toast.success(
        freshProfile.timezoneSource === "user"
          ? "Tu zona horaria personal quedo guardada."
          : "Se actualizo la zona horaria efectiva.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar tu zona horaria.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleInheritBranchTimezone = async () => {
    setSavingProfile(true);
    try {
      await apiService.updateProfileTimezone(null);
      const freshProfile = await syncProfile();
      setPersonalDraft(freshProfile.zonaHorariaResuelta);
      toast.success("Volviste a heredar la zona horaria de sucursal.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo volver a heredar la zona horaria.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveBranchTimezone = async () => {
    setSavingBranch(true);
    try {
      await apiService.actualizarConfiguracionGeneral({ zonaHoraria: branchTimezone });
      const freshProfile = await syncProfile();
      setBranchTimezone(freshProfile.zonaHorariaSucursal ?? branchTimezone);
      toast.success("Zona horaria de sucursal actualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar la zona horaria de sucursal.");
    } finally {
      setSavingBranch(false);
    }
  };

  const totalRegistrosMigracion = migrationStatus?.tablas.reduce((sum, table) => sum + table.registros, 0) ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-10 text-foreground">
      <header className="space-y-3">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground -ml-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Volver a Configuracion
        </Button>
        <div className="flex items-center gap-2 text-primary font-semibold tracking-wider uppercase text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20">
          <Settings2 className="h-3 w-3" />
          Configuracion General
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">Configuracion General</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          La zona horaria efectiva ahora sigue la precedencia usuario &gt; sucursal &gt; fallback tecnico.
        </p>
      </header>

      {migrationStatus?.needsMigration && (
        <Alert className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-300 font-semibold">Fechas con offset incorrecto detectadas</AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-400">
            <span>
              Se detectaron {totalRegistrosMigracion.toLocaleString()} registros con {migrationStatus.offsetHours}h de adelanto respecto a la zona horaria configurada ({migrationStatus.configuredTz}).
            </span>
            <Button variant="link" size="sm" className="h-auto p-0 ml-2 font-semibold text-yellow-800 dark:text-yellow-300 underline underline-offset-2" onClick={() => setDialogOpen(true)}>
              Revisar y corregir
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
          <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
            <div className="p-2 bg-primary/5 rounded-xl border border-primary/15"><UserRound className="w-5 h-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-base sm:text-lg tracking-tight">Mi zona horaria</h2>
                <Badge variant="outline">Origen actual: {getSourceLabel(resolvedProfile.timezoneSource)}</Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Tu preferencia personal tiene prioridad. Si la limpias, volves a heredar la configuracion de sucursal.</p>
            </div>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            {loadingPage || timezone.isLoading ? (
              <div className="flex items-center gap-3 py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Cargando tu configuracion horaria...</span></div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/50 bg-muted/20 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Resolucion efectiva</p><p className="mt-2 font-mono text-sm sm:text-base">{resolvedProfile.zonaHorariaResuelta}</p></div>
                  <div className="rounded-2xl border border-border/50 bg-muted/20 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Herencia de sucursal</p><p className="mt-2 font-mono text-sm sm:text-base">{resolvedProfile.zonaHorariaSucursal ?? "Sin configuracion"}</p></div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">Preferencia personal</label>
                  <p className="text-xs text-muted-foreground leading-relaxed">{resolvedProfile.zonaHoraria ? "Tenes una zona horaria propia activa para toda tu sesion." : "Actualmente heredas la zona horaria de sucursal o, si falta, el fallback tecnico."}</p>
                  <div className="max-w-md"><TimezoneSelector value={personalDraft} onChange={setPersonalDraft} disabled={savingProfile} /></div>
                </div>
              </>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end border-t border-border/30 pt-5">
              <Button variant="outline" onClick={handleInheritBranchTimezone} disabled={savingProfile || loadingPage || resolvedProfile.zonaHoraria === null} className="rounded-xl px-6 gap-2 h-10 sm:h-11">{savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Heredar sucursal</Button>
              <Button onClick={handleSaveProfileTimezone} disabled={savingProfile || loadingPage} className="rounded-xl px-6 gap-2 h-10 sm:h-11">{savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Guardar mi zona horaria</Button>
            </div>
          </div>
        </Card>

        <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
          <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
            <div className="p-2 bg-primary/5 rounded-xl border border-primary/15"><Globe className="w-5 h-5 text-primary" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-base sm:text-lg tracking-tight">Zona horaria de sucursal</h2>
                <Badge variant="secondary">Fallback organizacional</Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Se usa solo cuando un usuario no definio una preferencia personal. La migracion historica sigue asociada a esta configuracion.</p>
            </div>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Valor actual de sucursal</p><p className="mt-2 font-mono text-sm sm:text-base">{resolvedProfile.zonaHorariaSucursal ?? "Sin configuracion"}</p></div>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Impacta sobre</p><p className="mt-2 text-sm text-muted-foreground">Usuarios que heredan y procesos de compatibilidad historica.</p></div>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Configuracion de sucursal</label>
              <p className="text-xs text-muted-foreground leading-relaxed">{isAdmin ? "Como administrador podes ajustar la zona horaria heredada por la sucursal activa." : "Solo administradores pueden cambiar la zona horaria de sucursal."}</p>
              <div className="max-w-md"><TimezoneSelector value={branchTimezone} onChange={setBranchTimezone} disabled={!isAdmin || savingBranch || loadingPage} /></div>
            </div>
            <div className="flex justify-end border-t border-border/30 pt-5"><Button onClick={handleSaveBranchTimezone} disabled={!isAdmin || savingBranch || loadingPage} className="rounded-xl px-6 gap-2 h-10 sm:h-11">{savingBranch ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Guardar zona de sucursal</Button></div>
          </div>
        </Card>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/40 p-6 space-y-4">
        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><h2 className="text-lg font-bold">Estado del sistema</h2></div>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border/40 gap-4"><span className="text-muted-foreground">Zona horaria efectiva de esta sesion</span><span className="font-mono font-medium text-right">{resolvedProfile.zonaHorariaResuelta}</span></div>
          <div className="flex justify-between py-2 border-b border-border/40 gap-4"><span className="text-muted-foreground">Origen efectivo</span><span className="font-medium text-right">{getSourceLabel(resolvedProfile.timezoneSource)}</span></div>
          <div className="flex justify-between py-2 border-b border-border/40 gap-4"><span className="text-muted-foreground">Servidor PostgreSQL</span><span className="font-mono font-medium text-right">{migrationStatus?.serverTz ?? "-"}</span></div>
          <div className="flex justify-between py-2 gap-4"><span className="text-muted-foreground">Migracion de fechas historicas</span><span className={migrationStatus?.timezoneMigrationDone ? "text-green-600 dark:text-green-400 font-medium text-right" : migrationStatus?.needsMigration ? "text-yellow-600 dark:text-yellow-400 font-medium text-right" : "text-muted-foreground text-right"}>{migrationStatus?.timezoneMigrationDone ? "Completada" : migrationStatus?.needsMigration ? "Pendiente" : "No requerida"}</span></div>
        </div>
      </div>

      {migrationStatus && <TimezoneMigrationDialog open={dialogOpen} onOpenChange={setDialogOpen} migrationData={migrationStatus} onSuccess={handleMigrationSuccess} />}
    </div>
  );
}
