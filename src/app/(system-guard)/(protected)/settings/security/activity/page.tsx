"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { apiService } from "@/lib/apiService";

// UI
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ChevronLeft,
  Loader2,
  Calendar,
  Info,
  History,
  Eye,
  Globe,
  Monitor,
  Cpu,
  Settings,
  Shield,
  Database,
  LogIn,
  LogOut,
  PlusCircle,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { LucideIcon } from "lucide-react";

type AuditLogDetailValue = unknown;

type AuditLog = {
  id: number;
  createdAt: string;
  action: string;
  module: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  details?: Record<string, AuditLogDetailValue> | null;
  user?: {
    nombre: string;
  } | null;
};

function getDetailString(
  details: Record<string, AuditLogDetailValue>,
  key: string,
  fallback: string,
) {
  const value = details[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getDetailNumber(
  details: Record<string, AuditLogDetailValue>,
  key: string,
) {
  const value = details[key];
  return typeof value === "number" ? value : 0;
}

function LogDetailFormatter({ log }: { log: AuditLog }) {
  const details = log.details;
  if (!details)
    return <span className="text-muted-foreground/30 italic">Sin datos</span>;

  let summary = "";
  let Icon: LucideIcon = Info;
  let iconColor = "text-primary";

  // Enhanced logic for summary and icons
  switch (log.action) {
    case "LOGIN":
      summary = `Sesión iniciada: ${details.email || "usuario"}`;
      Icon = LogIn;
      iconColor = "text-[color:var(--status-success-strong)]";
      break;
    case "LOGOUT":
      summary = "Sesión cerrada";
      Icon = LogOut;
      iconColor = "text-[color:var(--status-warning)]";
      break;
    case "REVOKE_SESSION":
      summary = "Sesión revocada forzosamente";
      Icon = Shield;
      iconColor = "text-[color:var(--status-danger)]";
      break;
    case "STOCK_ADJUSTMENT": {
      const cantidad = getDetailNumber(details, "cantidad");
      summary = `Ajuste stock (${cantidad > 0 ? "+" : ""}${cantidad})`;
      Icon = RefreshCcw;
      iconColor = "text-[color:var(--theme-ocean-primary)]";
      break;
    }
    case "CREATE_PRODUCT":
      summary = `Producto nuevo: ${getDetailString(details, "nombre", "Sin nombre")}`;
      Icon = PlusCircle;
      iconColor = "text-[color:var(--status-success-strong)]";
      break;
    case "UPDATE_PRODUCT":
      summary = `Edición: ${getDetailString(details, "nombre", "Sin nombre")}`;
      Icon = RefreshCcw;
      iconColor = "text-[color:var(--theme-ocean-primary)]";
      break;
    case "DELETE_PRODUCT":
      summary = `Eliminado: ${getDetailString(details, "nombre", "Sin nombre")}`;
      Icon = Trash2;
      iconColor = "text-[color:var(--status-danger)]";
      break;
    default:
      summary = "Ver detalles técnicos";
      Icon = Database;
  }

  // Simple UA parsing for better display
  const getDeviceInfo = (ua?: string | null) => {
    if (!ua) return { os: "Desconocido", browser: "Desconocido" };
    const osMatch = ua.match(/\(([^)]+)\)/);
    const os = osMatch ? osMatch[1].split(";")[0] : "Desconocido";
    let browser = "Navegador";
    if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome"))
      browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";
    return { os, browser };
  };

  const deviceInfo = getDeviceInfo(log.userAgent);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2.5 text-[11px] text-muted-foreground hover:text-primary transition-all bg-muted/30 hover:bg-primary/5 px-4 py-2 rounded-2xl border border-border/40 group/btn">
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform group-hover/btn:scale-110",
              iconColor,
            )}
          />
          <span className="truncate max-w-[160px] font-semibold tracking-tight">
            {summary}
          </span>
          <Eye className="h-3.5 w-3.5 opacity-0 group-hover/btn:opacity-100 transition-all translate-x-1 group-hover/btn:translate-x-0 ml-auto" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2.5rem] border-none bg-background/80 backdrop-blur-3xl shadow-3xl">
        <div className="relative overflow-hidden">
          {/* Background decoration */}
          <div
            className={cn(
              "absolute -top-24 -right-24 w-48 h-48 blur-[80px] opacity-20 rounded-full bg-primary",
              iconColor.replace("text-", "bg-"),
            )}
          />

          <div className="p-8 pt-10 space-y-8 relative">
            <DialogHeader className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "h-14 w-14 rounded-[1.25rem] flex items-center justify-center shadow-lg border border-[color:var(--ui-fx-white)]/10",
                    iconColor
                      .replace("text-", "bg-")
                      .replace("-500", "-500/20"),
                  )}
                >
                  <Icon className={cn("h-7 w-7", iconColor)} />
                </div>
                <div className="space-y-1 text-left">
                  <DialogTitle className="text-2xl font-black tracking-tight leading-none group">
                    Detalle de Auditoría
                  </DialogTitle>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                    {log.module} • {log.action}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-6">
              {/* DATA SECTION */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Settings className="h-3.5 w-3.5 text-primary/60" />
                  <h3 className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/80">
                    Datos de la Operación
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-2.5 p-5 rounded-[2rem] bg-muted/30 border border-border/40 backdrop-blur-sm shadow-inner-sm">
                  {Object.entries(details).length > 0 ? (
                    Object.entries(details).map(([key, value]) => {
                      if (key === "hash" || key === "password") return null;
                      return (
                        <div
                          key={key}
                          className="flex flex-col gap-1 py-1.5 border-b border-border/20 last:border-0 group/field"
                        >
                          <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-wider group-hover/field:text-primary/50 transition-colors">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <span className="text-sm font-bold text-foreground/90 break-all leading-tight">
                            {typeof value === "object"
                              ? JSON.stringify(value, null, 2)
                              : String(value)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground italic py-2">
                      Sin metadatos adicionales
                    </p>
                  )}
                </div>
              </div>

              {/* DEVICE SECTION */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Monitor className="h-3.5 w-3.5 text-primary/60" />
                  <h3 className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/80">
                    Origen y Dispositivo
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/30 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-primary/70">
                      <Globe className="h-4 w-4" />
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        Dirección IP
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold tracking-tight">
                      {log.ipAddress || "Unknown"}
                    </span>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/30 flex flex-col gap-2 overflow-hidden">
                    <div className="flex items-center gap-2 text-primary/70">
                      <Cpu className="h-4 w-4" />
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        Sistema
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold truncate">
                        {deviceInfo.os}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 font-medium">
                        {deviceInfo.browser}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/10 border border-border/20 opacity-50 group hover:opacity-100 transition-opacity">
                  <p className="text-[9px] font-mono leading-relaxed truncate group-hover:whitespace-normal group-hover:break-all italic">
                    {log.userAgent || "No user agent provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ActivityLogPage() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getAuditLogs({ limit: 100 });
      setLogs(data);
    } catch {
      // toast.error("Error cargando logs");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-10 text-foreground selection:bg-primary/20">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <Link
            href="/settings/security"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver a Seguridad
          </Link>
          <div className="flex items-center gap-2 text-primary font-semibold tracking-wider uppercase text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20">
            <Activity className="h-3 w-3" />
            Auditoría
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground pb-2">
            Registro de Actividad
          </h1>
          <p className="text-sm text-muted-foreground">
            Historial detallado de todas las operaciones críticas realizadas en
            la plataforma.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={loadLogs}
          disabled={loading}
          className="rounded-2xl font-bold gap-2 h-12"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <History className="h-4 w-4" />
          )}
          Actualizar
        </Button>
      </header>

      {/* CONTENIDO */}
      <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl rounded-[2rem] overflow-hidden p-1">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4 opacity-70">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground animate-pulse">
              Consultando archivos...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-24 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-muted mx-auto flex items-center justify-center">
              <Activity className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground font-medium">
              No se han registrado actividades aún.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 bg-muted/20">
                <tr>
                  <th className="px-6 py-4 rounded-tl-[1.5rem]">
                    Fecha y Hora
                  </th>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Acción</th>
                  <th className="px-6 py-4">Módulo</th>
                  <th className="px-6 py-4 rounded-tr-[1.5rem]">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-muted/10 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium whitespace-nowrap">
                          {format(new Date(log.createdAt), "dd MMM, HH:mm", {
                            locale: es,
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {log.user ? (
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary uppercase">
                            {log.user.nombre.charAt(0)}
                          </div>
                          <span className="font-bold text-foreground truncate max-w-[120px]">
                            {log.user.nombre}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">
                          Sistema
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                          log.action === "LOGIN"
                            ? "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/20"
                            : log.action === "DELETE"
                              ? "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] border-[color:var(--status-danger)]/20"
                              : "bg-[color:var(--theme-ocean-primary)]/10 text-[color:var(--theme-ocean-primary)] border-[color:var(--theme-ocean-primary)]/20",
                        )}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-muted-foreground">
                      {log.module}
                    </td>
                    <td className="px-6 py-4">
                      <LogDetailFormatter log={log} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
