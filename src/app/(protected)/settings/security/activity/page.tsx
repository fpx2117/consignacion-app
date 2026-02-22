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
    User,
    Info,
    History,
    Eye,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

function LogDetailFormatter({ log }: { log: any }) {
    const details = log.details;
    if (!details) return <span className="text-muted-foreground/50">-</span>;

    let summary = "";

    // Generar resumen amigable según la acción
    switch (log.action) {
        case "LOGIN":
            summary = `Inicio de sesión exitoso (${details.email || "usuario"})`;
            break;
        case "LOGOUT":
            summary = "Cierre de sesión manual";
            break;
        case "REVOKE_SESSION":
            summary = `Sesión revocada para usuario ${details.revokedUserId || "ID: " + details.revokedSessionId}`;
            break;
        case "STOCK_ADJUSTMENT":
            summary = `Ajuste de stock: ${details.cantidad > 0 ? "+" : ""}${details.cantidad} unidades`;
            break;
        case "CREATE_PRODUCT":
            summary = `Producto creado: ${details.nombre}`;
            break;
        case "UPDATE_PRODUCT":
            summary = `Producto actualizado: ${details.nombre}`;
            break;
        default:
            summary = "Ver detalles de la acción";
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors bg-muted/40 px-3 py-1.5 rounded-xl border border-border/50 group/btn">
                    <Info className="h-3 w-3 shrink-0 text-primary/70" />
                    <span className="truncate max-w-[150px] font-medium">{summary}</span>
                    <Eye className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 transition-opacity ml-auto" />
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-[2rem] border-none bg-card/95 backdrop-blur-2xl shadow-2xl">
                <DialogHeader>
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                        <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-2xl font-black tracking-tight">Detalle de Auditoría</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Acción</p>
                            <p className="font-bold text-foreground">{log.action}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Módulo</p>
                            <p className="font-bold text-foreground">{log.module}</p>
                        </div>
                    </div>

                    <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2">Datos de la Operación</p>
                        <div className="space-y-2">
                            {Object.entries(details).map(([key, value]: [string, any]) => {
                                // Filtrar campos sensibles o aburridos
                                if (key === "hash" || key === "password") return null;

                                return (
                                    <div key={key} className="flex justify-between items-center gap-4 border-b border-border/30 pb-1.5 last:border-0">
                                        <span className="text-xs font-bold text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <span className="text-xs font-mono text-foreground truncate max-w-[200px]">
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground italic px-2">
                        <span>IP: {log.ipAddress || "Desconocida"}</span>
                        <span>•</span>
                        <span className="truncate">UA: {log.userAgent || "No registrado"}</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function ActivityLogPage() {
    const [logs, setLogs] = React.useState<any[]>([]);
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
                        Historial detallado de todas las operaciones críticas realizadas en la plataforma.
                    </p>
                </div>

                <Button
                    variant="outline"
                    onClick={loadLogs}
                    disabled={loading}
                    className="rounded-2xl font-bold gap-2 h-12"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
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
                        <p className="text-muted-foreground font-medium">No se han registrado actividades aún.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 bg-muted/20">
                                <tr>
                                    <th className="px-6 py-4 rounded-tl-[1.5rem]">Fecha y Hora</th>
                                    <th className="px-6 py-4">Usuario</th>
                                    <th className="px-6 py-4">Acción</th>
                                    <th className="px-6 py-4">Módulo</th>
                                    <th className="px-6 py-4 rounded-tr-[1.5rem]">Detalles</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted/10 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span className="font-medium whitespace-nowrap">
                                                    {format(new Date(log.createdAt), "dd MMM, HH:mm", { locale: es })}
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
                                                <span className="text-muted-foreground italic">Sistema</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                                log.action === "LOGIN" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                    log.action === "DELETE" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                        "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                            )}>
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
