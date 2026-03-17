"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Loader2, ArrowLeft, History, Store,
    AlertTriangle,
    Wallet, Search, FileText, Timer, ArrowUpRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { useTimezone } from "@/hooks/useTimezone";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

// --- HELPERS ---
const formatARS = (val: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val);

/**
 * Extrae las extensiones del string de observaciones de forma DINÁMICA
 * Detecta [EXTENSIÓN XXMIN: HH:mm]
 */
const parseExtensions = (obs: string | null | undefined) => {
    if (!obs) return [];
    // Regex mejorado para capturar cualquier número de minutos y la hora
    const regex = /\[EXTENSIÓN (\d+)MIN: (.*?)\]/g;
    const matches = [...obs.matchAll(regex)];
    return matches.map(m => ({
        mins: m[1],
        time: m[2]
    }));
};

/**
 * Limpia el ruido técnico de las observaciones
 */
const cleanObservaciones = (obs: string | null | undefined) => {
    if (!obs) return "Sin notas adicionales.";
    return obs
        .replace(/\[EXTENSIÓN \d+MIN:.*?\]/g, '') // Quita tags de extensión
        .replace(/Digital \(Transf\/Tarjeta\):.*?(?=\||$)/g, '') // Quita reporte digital
        .replace(/Digital:.*?(?=\||$)/g, '')
        .replace(/\|/g, '')
        .trim() || "Sin notas adicionales.";
};

export default function HistorialCajasPage() {
    const { formatDateTime } = useTimezone();
    const router = useRouter();
    const [sesiones, setSesiones] = React.useState<import("@/lib/types").SesionCaja[]>([]);
    const [cajasFisicas, setCajasFisicas] = React.useState<{ id: number; nombre: string; activa: boolean }[]>([]);
    const [loading, setLoading] = React.useState(true);

    // --- ESTADOS DE FILTROS ---
    const [searchTerm, setSearchTerm] = React.useState("");
    const [filterEstado, setFilterEstado] = React.useState("ALL");
    const [filterCaja, setFilterCaja] = React.useState("ALL");

    React.useEffect(() => {
        const load = async () => {
            try {
                const [resHistorial, resCajas] = await Promise.all([
                    apiService.getHistorialCajas(),
                    apiService.getCajasDisponibles()
                ]);
                setSesiones(resHistorial || []);
                setCajasFisicas(resCajas || []);
            } catch {
                toast.error("Error al cargar historial");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // --- LÓGICA DE FILTRADO ---
    const filteredSesiones = sesiones.filter(s => {
        const matchesSearch =
            s.usuario?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.caja?.nombre.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesEstado = filterEstado === "ALL" || s.estado === filterEstado;
        const matchesCaja = filterCaja === "ALL" || s.cajaId.toString() === filterCaja;

        return matchesSearch && matchesEstado && matchesCaja;
    });

    const stats = {
        abiertas: sesiones.filter(s => s.estado === "ABIERTA").length,
        totalDiferencia: sesiones.reduce((acc, s) => acc + Number(s.diferencia || 0), 0),
        // Calculamos el total de minutos extendidos en todo el historial
        totalMinutosExtendidos: sesiones.reduce((acc, s) => {
            const ext = parseExtensions(s.observaciones);
            return acc + ext.reduce((sum, e) => sum + parseInt(e.mins), 0);
        }, 0)
    };

    if (loading) return (
        <div className="h-[100dvh] flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-[color:var(--primary)]" />
                <p className="text-sm font-bold text-muted-foreground animate-pulse tracking-widest uppercase">Consultando Auditoría...</p>
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-10 pb-24 text-foreground selection:bg-[color:var(--primary)]/20">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[color:var(--primary)] dark:text-[color:var(--primary)] font-black tracking-[0.2em] uppercase text-[10px] bg-[color:var(--primary)]/10 w-fit px-3 py-1.5 rounded-full border border-[color:var(--primary)]/20 shadow-sm">
                        <History className="h-3.5 w-3.5" />
                        Control de Jornadas
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                        Historial de <span className="text-[color:var(--primary)] dark:text-[color:var(--primary)]">Turnos</span>
                    </h1>
                </div>
                <Button variant="outline" onClick={() => router.back()} className="rounded-2xl h-12 px-6 border-border/60 bg-card shadow-sm hover:bg-muted transition-all active:scale-95">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="Cajas Abiertas" value={stats.abiertas.toString()} icon={Store} color="violet" pulse={stats.abiertas > 0} />
                <StatCard title="Balance Global" value={formatARS(stats.totalDiferencia)} icon={Wallet} color={stats.totalDiferencia >= 0 ? "emerald" : "red"} />
                <StatCard title="Tiempo Extra Total" value={`${Math.floor(stats.totalMinutosExtendidos / 60)}h ${stats.totalMinutosExtendidos % 60}m`} icon={Timer} color="amber" />
            </div>

            {/* BARRA DE FILTROS */}
            <div className="bg-card/50 border border-border/40 p-5 rounded-[2.5rem] shadow-sm space-y-4 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[color:var(--primary)] transition-colors" />
                        <Input
                            placeholder="Buscar por cajero o terminal..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 h-12 rounded-2xl bg-background border-border/60 focus:ring-[color:var(--primary)]/20"
                        />
                    </div>

                    <Select value={filterEstado} onValueChange={setFilterEstado}>
                        <SelectTrigger className="h-12 rounded-2xl bg-background border-border/60">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                            <SelectItem value="ALL">Todos los estados</SelectItem>
                            <SelectItem value="ABIERTA">Abiertas</SelectItem>
                            <SelectItem value="CERRADA">Cerradas</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterCaja} onValueChange={setFilterCaja}>
                        <SelectTrigger className="h-12 rounded-2xl bg-background border-border/60">
                            <SelectValue placeholder="Terminal" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                            <SelectItem value="ALL">Todas las terminales</SelectItem>
                            {cajasFisicas.map(c => (
                                <SelectItem key={c.id} value={c.id.toString()}>{c.nombre}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* TABLA PRINCIPAL */}
            <Card className="rounded-[2.5rem] border-border/40 shadow-xl bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-muted/10 text-muted-foreground font-bold uppercase text-[10px] tracking-[0.2em] border-b border-border/40">
                            <tr>
                                <th className="p-6">Información del Turno</th>
                                <th className="p-6">Terminal</th>
                                <th className="p-6">Estado / Jornada</th>
                                <th className="p-6 text-right">Efectivo Final</th>
                                <th className="p-6 text-right">Diferencia</th>
                                <th className="p-6 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {filteredSesiones.map((s) => {
                                const dif = Number(s.diferencia || 0);
                                const isClosed = s.estado === "CERRADA";
                                const extensions = parseExtensions(s.observaciones);
                                const hasExtensions = extensions.length > 0;

                                return (
                                    <tr key={s.id} className="hover:bg-muted/30 transition-all group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-inner uppercase border",
                                                    hasExtensions ? "bg-[color:var(--status-warning)]/10 border-[color:var(--status-warning)]/20 text-[color:var(--status-warning)]" : "bg-[color:var(--primary)]/10 border-[color:var(--primary)]/20 text-[color:var(--primary)]"
                                                )}>
                                                    {s.usuario?.nombre.substring(0, 2)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-foreground text-base tracking-tight">{formatDateTime(s.fechaApertura)}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase">
                                                            {s.usuario?.nombre}
                                                        </span>
                                                        {hasExtensions && (
                                                            <Badge className="h-4 text-[9px] bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/20 px-1.5 font-black uppercase flex items-center gap-1">
                                                                <Timer className="h-2.5 w-2.5" /> {extensions.length} Ext.
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <Badge variant="secondary" className="rounded-xl px-3 py-1 font-bold bg-muted/50 border-border/60 text-[10px] uppercase text-muted-foreground">
                                                <Store className="h-3 w-3 mr-1.5" /> {s.caja?.nombre}
                                            </Badge>
                                        </td>
                                        <td className="p-6">
                                            <div className={cn(
                                                "w-fit px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border",
                                                isClosed ? "bg-muted text-muted-foreground border-border/50" : "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/20 animate-pulse"
                                            )}>
                                                <div className={cn("h-1.5 w-1.5 rounded-full", isClosed ? "bg-muted-foreground/50" : "bg-[color:var(--status-success-strong)]")} />
                                                {s.estado}
                                            </div>
                                        </td>
                                        <td className="p-6 text-right font-black text-foreground">
                                            {isClosed ? formatARS(Number(s.montoFinalReal)) : "En curso"}
                                        </td>
                                        <td className="p-6 text-right">
                                            {isClosed ? (
                                                <div className={cn(
                                                    "inline-flex px-3 py-1 rounded-xl border shadow-sm font-black text-sm",
                                                    dif < 0 ? "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] border-[color:var(--status-danger)]/20" : "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/20"
                                                )}>
                                                    {formatARS(dif)}
                                                </div>
                                            ) : <span className="text-muted-foreground/30 font-bold uppercase text-[10px]">---</span>}
                                        </td>
                                        <td className="p-6 text-center">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="rounded-xl hover:bg-[color:var(--primary)]/10 hover:text-[color:var(--primary)] transition-all"><FileText className="h-5 w-5" /></Button>
                                                </DialogTrigger>
                                                <DialogContent className="rounded-[2.5rem] sm:max-w-[500px] p-0 overflow-hidden border-border/40 shadow-2xl">
                                                    <div className="bg-[color:var(--primary)] p-8 text-[color:var(--ui-fx-white)] relative">
                                                        <History className="absolute right-6 top-6 h-20 w-20 opacity-10 rotate-12" />
                                                        <DialogHeader>
                                                            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Detalle de Auditoría</DialogTitle>
                                                            <DialogDescription className="text-[color:var(--primary)] font-medium opacity-80 italic">Turno #{s.id} • Terminal: {s.caja?.nombre}</DialogDescription>
                                                        </DialogHeader>
                                                    </div>

                                                    <div className="p-8 space-y-6 bg-background">

                                                        {/* SECCIÓN DE EXTENSIONES DINÁMICAS */}
                                                        {hasExtensions && (
                                                            <div className="space-y-3">
                                                                <p className="text-[10px] font-black text-[color:var(--status-warning)] uppercase tracking-widest flex items-center gap-2">
                                                                    <Timer className="h-3.5 w-3.5" /> Extensiones Solicitadas
                                                                </p>
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    {extensions.map((ext, idx) => (
                                                                        <div key={idx} className="flex items-center justify-between bg-[color:var(--status-warning)]/5 border border-[color:var(--status-warning)]/10 p-3 rounded-2xl animate-in slide-in-from-left-2 duration-300">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="h-8 w-8 rounded-xl bg-[color:var(--status-warning)]/10 flex items-center justify-center text-[color:var(--status-warning)]">
                                                                                    <ArrowUpRight className="h-4 w-4" />
                                                                                </div>
                                                                                <span className="text-sm font-bold text-foreground">+{ext.mins} Minutos extra</span>
                                                                            </div>
                                                                            <span className="text-xs font-black text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10 px-2 py-1 rounded-lg">{ext.time}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <Separator className="opacity-50" />
                                                            </div>
                                                        )}

                                                        <div className="space-y-4">
                                                            <div className="flex justify-between items-center text-sm font-medium">
                                                                <span className="text-muted-foreground">Efectivo Inicial:</span>
                                                                <span className="font-bold">{formatARS(Number(s.montoInicial))}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-sm font-medium">
                                                                <span className="text-muted-foreground">Esperado en Caja:</span>
                                                                <span className="font-bold">{formatARS(Number(s.montoFinalEsperado))}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center pt-3 border-t border-dashed text-lg font-black text-[color:var(--primary)]">
                                                                <span>Real Declarado:</span>
                                                                <span>{formatARS(Number(s.montoFinalReal))}</span>
                                                            </div>
                                                        </div>

                                                        <div className="bg-[color:var(--primary)]/5 p-5 rounded-2xl border border-[color:var(--primary)]/10 space-y-2">
                                                            <p className="text-[10px] font-black text-[color:var(--primary)] uppercase tracking-widest flex items-center gap-2">
                                                                <AlertTriangle className="h-3.5 w-3.5" /> Comentarios del Cajero
                                                            </p>
                                                            <p className="text-sm italic text-muted-foreground leading-relaxed font-medium">
                                                                &quot;{cleanObservaciones(s.observaciones)}&quot;
                                                            </p>
                                                        </div>

                                                        <Button className="w-full h-12 rounded-xl bg-foreground text-background font-bold uppercase tracking-widest text-[10px] hover:scale-[0.98] transition-transform">Imprimir Reporte Técnico</Button>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    smallValue?: string;
    pulse?: boolean;
}
function StatCard({ title, value, icon: Icon, color, smallValue, pulse }: StatCardProps) {
    const colorConfigs: Record<string, string> = {
        violet: "bg-[color:var(--primary)]/10 text-[color:var(--primary)] border-[color:var(--primary)]/20 shadow-violet-500/5",
        emerald: "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/20 shadow-emerald-500/5",
        red: "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] border-[color:var(--status-danger)]/20 shadow-red-500/5",
        amber: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/20 shadow-amber-500/5",
        slate: "bg-muted/55 text-muted-foreground border-border shadow-slate-500/5",
    };

    return (
        <Card className="bg-card/40 backdrop-blur-xl border-border/60 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all duration-300 group">
            <CardContent className="p-7 flex items-center gap-5">
                <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105 duration-500 shadow-inner",
                    colorConfigs[color],
                    pulse && "animate-pulse"
                )}>
                    <Icon className="h-7 w-7" />
                </div>
                <div className="flex flex-col">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{title}</p>
                    <p className={cn(
                        "font-black tracking-tight text-foreground leading-none",
                        smallValue ? "text-xl" : "text-3xl"
                    )}>{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}
