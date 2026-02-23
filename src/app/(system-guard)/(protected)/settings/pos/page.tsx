"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Loader2, ArrowLeft, Plus, Store,
    MonitorSmartphone, Clock, ChevronRight, Settings2, TerminalSquare, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";

export default function PosSettingsPage() {
    const router = useRouter();

    const [cajas, setCajas] = React.useState<any[]>([]);
    const [nombreNuevaCaja, setNombreNuevaCaja] = React.useState("");
    const [usarControlDeCaja, setUsarControlDeCaja] = React.useState(true);

    const [loading, setLoading] = React.useState(true);
    const [loadingConfigToggle, setLoadingConfigToggle] = React.useState(false);
    const [loadingSubmit, setLoadingSubmit] = React.useState(false);

    const fetchInitialData = React.useCallback(async () => {
        try {
            // 1. Cargamos rápido desde la caché local para evitar parpadeos visuales
            const cachedConfig = localStorage.getItem("usarControlDeCaja");
            if (cachedConfig !== null) {
                setUsarControlDeCaja(cachedConfig === "true");
            }

            // 2. Buscamos la verdad absoluta en el servidor
            const [cajasRes, configRes] = await Promise.all([
                apiService.getCajasDisponibles(),
                apiService.getConfiguracionGeneral()
            ]);

            // Ensure array is treated directly
            setCajas(Array.isArray(cajasRes) ? cajasRes : []);

            // The API response for configRes might be wrapped or direct.
            // We prioritize the direct property if available, otherwise check for a 'data' wrapper.
            const valorRealDb = configRes?.usarControlDeCaja ?? configRes?.data?.usarControlDeCaja ?? true;

            setUsarControlDeCaja(valorRealDb);
            localStorage.setItem("usarControlDeCaja", String(valorRealDb)); // Actualizamos caché

        } catch (error: any) {
            toast.error(error.message || "Error al cargar los datos.");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const handleCrearCaja = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombreNuevaCaja.trim()) return;

        setLoadingSubmit(true);
        try {
            await apiService.crearCajaFisica(nombreNuevaCaja);
            toast.success("Terminal creada correctamente.");
            setNombreNuevaCaja("");
            const res = await apiService.getCajasDisponibles();
            setCajas(Array.isArray(res) ? res : []);
        } catch (error: any) {
            toast.error(error.message || "No se pudo crear la terminal.");
        } finally {
            setLoadingSubmit(false);
        }
    };

    const handleToggleControlCaja = async (checked: boolean) => {
        setLoadingConfigToggle(true);
        try {
            await apiService.actualizarConfiguracionGeneral({ usarControlDeCaja: checked });
            setUsarControlDeCaja(checked);

            // ✅ Guardamos en localStorage para persistencia instantánea
            localStorage.setItem("usarControlDeCaja", String(checked));

            // 🔥 ESTO ENVÍA LA SEÑAL A TODA LA APP (Sidebar, Ventas, etc.)
            window.dispatchEvent(new CustomEvent("config-updated", {
                detail: { usarControlDeCaja: checked }
            }));

            toast.success(`Modo estricto ${checked ? "activado" : "desactivado"}`);
        } catch (error: any) {
            toast.error("Error al actualizar la configuración.");
            setUsarControlDeCaja(!checked); // Revertimos si falla
        } finally {
            setLoadingConfigToggle(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-8 text-foreground selection:bg-primary/20">

            {/* HEADER MINIMALISTA */}
            <header className="flex items-center gap-5 mb-4">
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-full h-11 w-11 border-border/40 shadow-sm hover:bg-muted/50 transition-colors"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5">
                        <MonitorSmartphone className="h-6 w-6 text-primary/80" />
                        Punto de Venta
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestiona las preferencias de cobro, restricciones y terminales físicas.
                    </p>
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">Cargando preferencias...</p>
                </div>
            ) : (
                <div className="grid gap-8">

                    {/* BLOQUE 1: REGLAS DE NEGOCIO */}
                    <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
                        <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
                            <div className="p-2 bg-primary/5 rounded-xl border border-primary/10">
                                <Settings2 className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg tracking-tight">Reglas de Operación</h2>
                                <p className="text-sm text-muted-foreground">Configuración del comportamiento de la caja.</p>
                            </div>
                        </div>

                        <div className="divide-y divide-border/40">
                            {/* Ajuste: Modo Estricto */}
                            <div className="p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1 pr-4">
                                    <h3 className="font-medium text-base text-foreground">Modo Estricto de Caja</h3>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                        Exige la apertura de un turno de caja para procesar ventas. Si se desactiva, el sistema permitirá registrar ventas casuales de forma directa.
                                    </p>
                                </div>
                                <div className="pt-2 sm:pt-0 shrink-0 flex items-center">
                                    {loadingConfigToggle ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                                    ) : (
                                        <Switch
                                            checked={usarControlDeCaja}
                                            onCheckedChange={handleToggleControlCaja}
                                            className="data-[state=checked]:bg-primary"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Ajuste: Horarios (CONDICIONAL) */}
                            <div
                                onClick={() => {
                                    if (usarControlDeCaja) router.push('/settings/pos/horarios');
                                }}
                                className={cn(
                                    "p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors",
                                    usarControlDeCaja
                                        ? "hover:bg-muted/30 cursor-pointer group"
                                        : "opacity-50 cursor-not-allowed bg-muted/10 grayscale"
                                )}
                            >
                                <div className="flex items-start sm:items-center gap-4">
                                    <div className={cn(
                                        "mt-1 sm:mt-0 p-2.5 rounded-xl transition-colors",
                                        usarControlDeCaja ? "bg-muted group-hover:bg-primary group-hover:text-primary-foreground" : "bg-muted/50 text-muted-foreground"
                                    )}>
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className={cn(
                                                "font-medium text-base transition-colors",
                                                usarControlDeCaja ? "text-foreground group-hover:text-primary" : "text-muted-foreground"
                                            )}>
                                                Control de Horarios
                                            </h3>
                                            {!usarControlDeCaja && (
                                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-background border border-border/50 text-muted-foreground px-2 py-0.5 rounded-full">
                                                    <Info className="h-3 w-3" /> Requiere Modo Estricto
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Restringe los accesos al POS según el turno laboral de cada empleado.
                                        </p>
                                    </div>
                                </div>
                                {usarControlDeCaja && (
                                    <div className="h-8 w-8 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform shrink-0">
                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* BLOQUE 2: TERMINALES */}
                    <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
                        <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
                            <div className="p-2 bg-primary/5 rounded-xl border border-primary/10">
                                <TerminalSquare className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg tracking-tight">Terminales Físicas</h2>
                                <p className="text-sm text-muted-foreground">Administración de puntos de cobro y gavetas operativas.</p>
                            </div>
                        </div>

                        <div className="p-6 md:p-8 space-y-6 bg-muted/5">
                            {/* Formulario Inline */}
                            <form onSubmit={handleCrearCaja} className="flex flex-col sm:flex-row gap-3">
                                <Input
                                    placeholder="Identificador de la terminal (Ej: Caja Mostrador 1)"
                                    value={nombreNuevaCaja}
                                    onChange={(e) => setNombreNuevaCaja(e.target.value)}
                                    className="flex-1 h-12 rounded-xl bg-background border-border/50 focus-visible:ring-primary/20 transition-all shadow-sm"
                                    required
                                />
                                <Button
                                    type="submit"
                                    disabled={loadingSubmit || !nombreNuevaCaja.trim()}
                                    className="h-12 px-8 rounded-xl font-medium shadow-sm shrink-0"
                                >
                                    {loadingSubmit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                    Añadir Terminal
                                </Button>
                            </form>

                            {/* Lista de Cajas */}
                            <div className="bg-background rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                                {cajas.length === 0 ? (
                                    <div className="py-16 flex flex-col items-center justify-center text-muted-foreground/40">
                                        <Store className="h-10 w-10 mb-3 opacity-20" />
                                        <p className="text-sm font-medium tracking-wide">NO HAY TERMINALES REGISTRADAS</p>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-border/40">
                                        {cajas.map((caja) => (
                                            <li key={caja.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-muted/30 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center shrink-0">
                                                        <Store className="h-4 w-4 text-foreground/70" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-sm text-foreground">{caja.nombre}</span>
                                                        <span className="text-[11px] text-muted-foreground font-mono mt-0.5 opacity-80">REF-{caja.id.toString().padStart(4, '0')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/20">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                    Operativa
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}