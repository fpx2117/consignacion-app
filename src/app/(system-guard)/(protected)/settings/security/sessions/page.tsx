/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { apiService } from "@/lib/apiService";
import { toast } from "sonner";

// UI
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Fingerprint,
    ChevronLeft,
    Loader2,
    LogOut,
    Smartphone,
    Monitor,
    Globe,
    ShieldCheck,
} from "lucide-react";

export default function SessionsPage() {
    const [sessions, setSessions] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [revoking, setRevoking] = React.useState<string | null>(null);

    const loadSessions = React.useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiService.getActiveSessions();
            setSessions(data);
        } catch (error: any) {
            toast.error(error.message || "Error cargando sesiones");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleRevoke = async (id: string) => {
        setRevoking(id);
        try {
            await apiService.revokeSession(id);
            toast.success("Sesión revocada");
            setSessions((prev) => prev.filter((s) => s.id !== id));
        } catch {
            toast.error("Error al revocar sesión");
        } finally {
            setRevoking(null);
        }
    };

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
                        <Fingerprint className="h-3 w-3" />
                        Control de Dispositivos
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground pb-2">
                        Sesiones Activas
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Dispositivos conectados actualmente. Podés revocar el acceso a cualquier sesión sospechosa.
                    </p>
                </div>
            </header>

            {/* CONTENIDO */}
            <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl rounded-[2rem] overflow-hidden p-6">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-4 opacity-70">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-[10px] font-black tracking-widest uppercase text-muted-foreground animate-pulse">
                            Escaneando red...
                        </p>
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="py-24 text-center">
                        <p className="text-muted-foreground">No hay sesiones activas (eso es raro, ¿cómo estás aquí?).</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {sessions.map((session) => {
                            const isMobile = session.userAgent?.toLowerCase().includes("mobile") || session.userAgent?.toLowerCase().includes("android");
                            const Icon = isMobile ? Smartphone : Monitor;

                            return (
                                <div key={session.id} className="flex flex-col md:flex-row items-center justify-between p-5 rounded-3xl bg-muted/30 border border-border/50 group hover:border-primary/30 transition-all">
                                    <div className="flex items-center gap-5 w-full md:w-auto">
                                        <div className="h-14 w-14 rounded-2xl bg-background border border-border/50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <Icon className="h-7 w-7 text-primary" />
                                        </div>
                                        <div className="space-y-1 overflow-hidden">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-lg">{session.user?.nombre || "Usuario"}</h3>
                                                {session.isActive && (
                                                    <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">En línea</div>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground italic">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <Globe className="h-3 w-3 text-primary/70" />
                                                    {session.ipAddress || "IP Desconocida"}
                                                </div>
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <ShieldCheck className="h-3 w-3 text-primary/70" />
                                                    {session.os || "SO"} • {session.browser || "Navegador"}
                                                </div>
                                                <div className="flex items-center gap-1.5 font-medium text-[10px] opacity-70">
                                                    Iniciada {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true, locale: es })}
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground/60 truncate max-w-[300px] mt-1">
                                                {session.userAgent || "Sin información de dispositivo"}
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={revoking === session.id}
                                        onClick={() => handleRevoke(session.id)}
                                        className="mt-4 md:mt-0 rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-500 font-bold gap-2 px-4"
                                    >
                                        {revoking === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                                        Revocar Acceso
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}
