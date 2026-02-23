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
    ChevronRight,
    Info,
    Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";

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
            // El API devuelve { data: config } o config directamente según apiData
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
        <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-8 text-foreground selection:bg-primary/20">
            {/* HEADER */}
            <header className="flex items-center gap-5 mb-4">
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-full h-11 w-11 border-border/40 shadow-sm hover:bg-muted/50 transition-colors"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5">
                        <BellRing className="h-6 w-6 text-pink-500/80" />
                        Notificaciones
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Personalizá cómo y cuándo querés recibir alertas del sistema.
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={loading || loadingSubmit}
                    className="rounded-xl px-6 h-11 font-medium shadow-lg hover:shadow-xl transition-all"
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
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">
                        Obteniendo preferencias...
                    </p>
                </div>
            ) : (
                <div className="grid gap-8">
                    {/* BLOQUE: ALERTAS DE INVENTARIO */}
                    <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
                        <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
                            <div className="p-2 bg-primary/5 rounded-xl border border-primary/10">
                                <PackageSearch className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg tracking-tight">Inventario y Stock</h2>
                                <p className="text-sm text-muted-foreground">Configurá las alertas de reposición.</p>
                            </div>
                        </div>

                        <div className="divide-y divide-border/40">
                            {/* Notificar Stock Bajo */}
                            <div className="p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1 pr-4">
                                    <h3 className="font-medium text-base text-foreground">Alertas de Stock Bajo</h3>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                        Recibí una notificación cuando un producto alcance el nivel mínimo definido.
                                    </p>
                                </div>
                                <div className="pt-2 sm:pt-0 shrink-0">
                                    <Switch
                                        checked={config.notificarStockBajo}
                                        onCheckedChange={handleToggle("notificarStockBajo")}
                                        className="data-[state=checked]:bg-primary"
                                    />
                                </div>
                            </div>

                            {/* Stock Mínimo Global */}
                            <div className="p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1 pr-4">
                                    <h3 className="font-medium text-base text-foreground">Stock Mínimo Global</h3>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                        Valor por defecto para productos que no tengan un mínimo específico.
                                    </p>
                                </div>
                                <div className="pt-2 sm:pt-0 shrink-0 w-full sm:w-32">
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
                    <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
                        <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
                            <div className="p-2 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                <CalendarClock className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg tracking-tight">Vencimientos</h2>
                                <p className="text-sm text-muted-foreground">Control de caducidad de productos.</p>
                            </div>
                        </div>

                        <div className="divide-y divide-border/40">
                            {/* Notificar Vencimientos */}
                            <div className="p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1 pr-4">
                                    <h3 className="font-medium text-base text-foreground">Notificar Vencimientos</h3>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                        Activá las alertas preventivas para productos próximos a vencer.
                                    </p>
                                </div>
                                <div className="pt-2 sm:pt-0 shrink-0">
                                    <Switch
                                        checked={config.notificarVencimientos}
                                        onCheckedChange={handleToggle("notificarVencimientos")}
                                        className="data-[state=checked]:bg-primary"
                                    />
                                </div>
                            </div>

                            {/* Días de Anticipación */}
                            <div className="p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1 pr-4">
                                    <h3 className="font-medium text-base text-foreground">Anticipación de Alerta</h3>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                        ¿Cuántos días antes del vencimiento querés recibir el aviso?
                                    </p>
                                </div>
                                <div className="pt-2 sm:pt-0 shrink-0 w-full sm:w-32">
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={config.diasAnticipacionVencimiento}
                                            onChange={handleInputChange("diasAnticipacionVencimiento")}
                                            className="h-10 rounded-xl bg-background border-border/50 text-center font-bold"
                                        />
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Días</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* BLOQUE: VENTAS Y ACTIVIDAD */}
                    <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
                        <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
                            <div className="p-2 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                <Settings2 className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg tracking-tight">Actividad de Ventas</h2>
                                <p className="text-sm text-muted-foreground">Alertas de transacciones en tiempo real.</p>
                            </div>
                        </div>

                        <div className="divide-y divide-border/40">
                            {/* Notificar Ventas */}
                            <div className="p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                                <div className="flex-1 pr-4">
                                    <h3 className="font-medium text-base text-foreground">Confirmación de Ventas</h3>
                                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                        Recibí alertas cada vez que se procese una venta en cualquier terminal.
                                    </p>
                                </div>
                                <div className="pt-2 sm:pt-0 shrink-0">
                                    <Switch
                                        checked={config.notificarVentas}
                                        onCheckedChange={handleToggle("notificarVentas")}
                                        className="data-[state=checked]:bg-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* INFO BOX */}
                    <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 flex items-start gap-4 shadow-sm">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Info className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-primary text-sm mb-1 uppercase tracking-tight">Nota sobre Sincronización</h4>
                            <p className="text-sm text-primary/70 leading-relaxed">
                                Estas preferencias se aplican de forma global para todos los administradores. Los cambios pueden tardar unos minutos en reflejarse en las alertas por correo electrónico o notificaciones push si están habilitadas.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
