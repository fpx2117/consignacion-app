"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Loader2,
    ArrowLeft,
    BellRing,
    Settings2,
    PackageSearch,
    CalendarClock,
    Info,
    Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";

export default function NotificationSettingsPage() {
    const router = useRouter();

    const [loading, setLoading] = React.useState(true);
    const [loadingSubmit, setLoadingSubmit] = React.useState(false);

    // Form State
    const [config, setConfig] = React.useState({
        minStockGlobal: 5,
        diasAnticipacionVencimiento: 7,
        notificarVencimientos: true,
        notificarStockBajo: true,
        notificarVentas: true,
    });

    const fetchConfig = React.useCallback(async () => {
        try {
            const res = await apiService.getConfiguracionGeneral();
            const data = res?.data ?? res;

            if (data) {
                setConfig({
                    minStockGlobal: data.minStockGlobal ?? 5,
                    diasAnticipacionVencimiento: data.diasAnticipacionVencimiento ?? 7,
                    notificarVencimientos: data.notificarVencimientos ?? true,
                    notificarStockBajo: data.notificarStockBajo ?? true,
                    notificarVentas: data.notificarVentas ?? true,
                });
            }
        } catch (error: any) {
            toast.error(error.message || "Error al cargar la configuración.");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleSave = async () => {
        setLoadingSubmit(true);
        try {
            await apiService.actualizarConfiguracionGeneral(config);
            toast.success("Configuración de notificaciones actualizada.");
        } catch (error: any) {
            toast.error(error.message || "Error al guardar los cambios.");
        } finally {
            setLoadingSubmit(false);
        }
    };

    const handleToggle = (key: keyof typeof config) => (checked: boolean) => {
        setConfig((prev) => ({ ...prev, [key]: checked }));
    };

    const handleInputChange = (key: keyof typeof config) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setConfig((prev) => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 p-3 md:p-8 text-foreground selection:bg-primary/20">
            {/* HEADER */}
            <header className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 mb-4 sm:mb-6">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 rounded-full h-10 w-10 md:h-11 md:w-11 border-border/40 shadow-sm hover:bg-muted/50 transition-colors"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2.5">
                            <BellRing className="h-5 w-5 md:h-6 md:w-6 text-pink-500/80" />
                            Notificaciones
                        </h1>
                        <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">
                            Alertas y preferencias del sistema.
                        </p>
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={loading || loadingSubmit}
                    className="w-full sm:w-auto rounded-xl px-6 h-11 font-medium shadow-lg hover:shadow-xl transition-all sm:ml-auto"
                >
                    {loadingSubmit ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Save className="h-4 w-4 mr-2" />
                    )}
                    Guardar Cambios
                </Button>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 md:py-32 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">
                        Obteniendo preferencias...
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 md:gap-8">
                    {/* BLOQUE: ALERTAS DE INVENTARIO */}
                    <Card className="rounded-[20px] md:rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
                        <div className="p-4 md:p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
                            <div className="p-2 bg-primary/5 rounded-lg md:rounded-xl border border-primary/10">
                                <PackageSearch className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-base md:text-lg tracking-tight">Inventario y Stock</h2>
                                <p className="text-xs md:text-sm text-muted-foreground">Alertas de reposición.</p>
                            </div>
                        </div>

                        <div className="divide-y divide-border/40">
                            <div className="p-4 md:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1">
                                    <h3 className="font-medium text-sm md:text-base text-foreground">Alertas de Stock Bajo</h3>
                                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 leading-relaxed">
                                        Notificación al alcanzar el nivel mínimo.
                                    </p>
                                </div>
                                <div className="shrink-0 flex justify-end">
                                    <Switch
                                        checked={config.notificarStockBajo}
                                        onCheckedChange={handleToggle("notificarStockBajo")}
                                        className="scale-90 md:scale-100 data-[state=checked]:bg-primary"
                                    />
                                </div>
                            </div>

                            <div className="p-4 md:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1">
                                    <h3 className="font-medium text-sm md:text-base text-foreground">Stock Mínimo Global</h3>
                                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 leading-relaxed">
                                        Por defecto para productos sin mínimo.
                                    </p>
                                </div>
                                <div className="shrink-0 w-full sm:w-28 md:w-32">
                                    <Input
                                        type="number"
                                        value={config.minStockGlobal}
                                        onChange={handleInputChange("minStockGlobal")}
                                        className="h-10 rounded-xl bg-background border-border/50 text-center font-bold"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* BLOQUE: FECHAS Y VENCIMIENTOS */}
                    <Card className="rounded-[20px] md:rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
                        <div className="p-4 md:p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
                            <div className="p-2 bg-amber-500/5 rounded-lg md:rounded-xl border border-amber-500/10">
                                <CalendarClock className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-base md:text-lg tracking-tight">Vencimientos</h2>
                                <p className="text-xs md:text-sm text-muted-foreground">Control de caducidad.</p>
                            </div>
                        </div>

                        <div className="divide-y divide-border/40">
                            <div className="p-4 md:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1">
                                    <h3 className="font-medium text-sm md:text-base text-foreground">Notificar Vencimientos</h3>
                                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 leading-relaxed">
                                        Alertas preventivas de caducidad.
                                    </p>
                                </div>
                                <div className="shrink-0 flex justify-end">
                                    <Switch
                                        checked={config.notificarVencimientos}
                                        onCheckedChange={handleToggle("notificarVencimientos")}
                                        className="scale-90 md:scale-100 data-[state=checked]:bg-primary"
                                    />
                                </div>
                            </div>

                            <div className="p-4 md:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1">
                                    <h3 className="font-medium text-sm md:text-base text-foreground">Anticipación de Alerta</h3>
                                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 leading-relaxed">
                                        Días previos para recibir el aviso.
                                    </p>
                                </div>
                                <div className="shrink-0 w-full sm:w-32 flex items-center gap-3">
                                    <Input
                                        type="number"
                                        value={config.diasAnticipacionVencimiento}
                                        onChange={handleInputChange("diasAnticipacionVencimiento")}
                                        className="h-10 flex-1 rounded-xl bg-background border-border/50 text-center font-bold"
                                    />
                                    <span className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Días</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* BLOQUE: VENTAS Y ACTIVIDAD */}
                    <Card className="rounded-[20px] md:rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
                        <div className="p-4 md:p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
                            <div className="p-2 bg-emerald-500/5 rounded-lg md:rounded-xl border border-emerald-500/10">
                                <Settings2 className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-base md:text-lg tracking-tight">Actividad de Ventas</h2>
                                <p className="text-xs md:text-sm text-muted-foreground">Alertas en tiempo real.</p>
                            </div>
                        </div>

                        <div className="divide-y divide-border/40">
                            <div className="p-4 md:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1">
                                    <h3 className="font-medium text-sm md:text-base text-foreground">Confirmación de Ventas</h3>
                                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 leading-relaxed">
                                        Alertas al procesar ventas.
                                    </p>
                                </div>
                                <div className="shrink-0 flex justify-end">
                                    <Switch
                                        checked={config.notificarVentas}
                                        onCheckedChange={handleToggle("notificarVentas")}
                                        className="scale-90 md:scale-100 data-[state=checked]:bg-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* INFO BOX */}
                    <div className="bg-primary/5 border border-primary/10 rounded-[20px] md:rounded-3xl p-4 md:p-6 flex flex-col sm:flex-row items-start gap-3 md:gap-4 shadow-sm">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                            <Info className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-primary text-xs md:text-sm mb-1 uppercase tracking-tight">Sincronización Global</h4>
                            <p className="text-xs md:text-sm text-primary/70 leading-relaxed">
                                Los cambios afectan a todos los administradores.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
