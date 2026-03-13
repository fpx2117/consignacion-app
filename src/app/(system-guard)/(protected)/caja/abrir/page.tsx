/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Wallet, Store, Banknote, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";

export default function AbrirCajaPage() {
    const router = useRouter();

    const [cajas, setCajas] = React.useState<any[]>([]);
    const [selectedCajaId, setSelectedCajaId] = React.useState<string>("");

    // Guardaremos el número en crudo ("15000") pero lo mostraremos formateado ("15.000")
    const [montoInicial, setMontoInicial] = React.useState<string>("");

    const [loading, setLoading] = React.useState(false);
    const [loadingData, setLoadingData] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchCajas = async () => {
            try {
                const res = await apiService.getCajasDisponibles();
                setCajas(res || []);
                if (res && res.length > 0) {
                    setSelectedCajaId(String(res[0].id));
                }
            } catch (err: any) {
                setError(err.message || "Error al cargar las cajas.");
            } finally {
                setLoadingData(false);
            }
        };

        fetchCajas();
    }, []);

    const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, "");
        setMontoInicial(rawValue);
    };

    const handleAbrirCaja = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!selectedCajaId) {
            setError("Debes seleccionar una terminal física.");
            return;
        }

        if (montoInicial === "" || isNaN(Number(montoInicial)) || Number(montoInicial) < 0) {
            setError("El monto inicial debe ser un número válido.");
            return;
        }

        setLoading(true);

        try {
            await apiService.abrirCaja({
                cajaId: Number(selectedCajaId),
                montoInicial: Number(montoInicial),
            });

            toast.success("¡Turno abierto exitosamente!");
            router.push("/ventas/nueva");

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    if (loadingData) {
        return (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-[color:var(--primary)]" />
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Conectando con terminales...</p>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-[color:var(--primary)]/20">

            {/* HEADER MINIMALISTA */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 px-4 py-3 flex items-center gap-3">
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-full h-10 w-10 border-border/50 hover:bg-muted/50 transition-colors"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-lg font-bold tracking-tight leading-none">Apertura de Caja</h1>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">Módulo POS</p>
                </div>
            </div>

            {/* CONTENIDO CENTRAL */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-500">

                    <div className="bg-card border border-border/40 shadow-xl shadow-violet-500/5 rounded-[2rem] p-6 md:p-8 space-y-8 relative overflow-hidden">

                        {/* DESTELLO DE FONDO (Opcional, le da un toque premium) */}
                        <div className="absolute -top-12 -right-12 h-32 w-32 bg-[color:var(--primary)]/10 rounded-full blur-3xl" />

                        <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                            <div className="h-16 w-16 bg-[color:var(--primary)]/10 rounded-2xl flex items-center justify-center text-[color:var(--primary)] dark:text-[color:var(--primary)] shadow-inner rotate-3 transition-transform hover:rotate-0 duration-300">
                                <Wallet className="h-8 w-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tight text-foreground">Inicio de Jornada</h2>
                                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed px-2">
                                    Declara el efectivo con el que inicias para realizar un arqueo preciso al cierre.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive" className="rounded-xl border-[color:var(--status-danger)]/20 bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] dark:text-[color:var(--status-danger)]">
                                <AlertDescription className="font-medium text-center">{error}</AlertDescription>
                            </Alert>
                        )}

                        <form onSubmit={handleAbrirCaja} className="space-y-6 relative z-10">

                            {/* SELECTOR DE CAJA */}
                            <div className="space-y-2.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 ml-1">
                                    <Store className="h-3.5 w-3.5" />
                                    Terminal a operar
                                </label>
                                <div className="relative">
                                    <select
                                        value={selectedCajaId}
                                        onChange={(e) => setSelectedCajaId(e.target.value)}
                                        className="appearance-none flex h-12 w-full rounded-xl border border-border/50 bg-background/50 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]/20 focus-visible:border-[color:var(--primary)]/50 disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={cajas.length === 0}
                                    >
                                        {cajas.length === 0 && <option value="">No hay terminales disponibles</option>}
                                        {cajas.map((caja) => (
                                            <option key={caja.id} value={caja.id}>
                                                {caja.nombre}
                                            </option>
                                        ))}
                                    </select>
                                    {/* Ícono personalizado para el select */}
                                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            </div>

                            {/* MONTO INICIAL FORMATO ARS */}
                            <div className="space-y-2.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 ml-1">
                                    <Banknote className="h-3.5 w-3.5" />
                                    Fondo de Cambio (Efectivo)
                                </label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-lg transition-colors group-focus-within:text-[color:var(--primary)]">
                                        $
                                    </span>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={montoInicial ? new Intl.NumberFormat("es-AR").format(Number(montoInicial)) : ""}
                                        onChange={handleMontoChange}
                                        className="pl-9 h-14 text-2xl font-black rounded-xl border-border/50 bg-background/50 focus-visible:ring-[color:var(--primary)]/20 focus-visible:border-[color:var(--primary)]/50 transition-all shadow-sm"
                                        placeholder="0"
                                        required
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-14 text-base font-black rounded-xl bg-[color:var(--primary)] hover:bg-[color:var(--primary)] text-[color:var(--ui-fx-white)] shadow-lg shadow-violet-500/25 transition-all active:scale-[0.98]"
                                disabled={loading || cajas.length === 0}
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Abrir Turno e Iniciar Ventas"}
                            </Button>
                        </form>
                    </div>

                    {/* NOTA AL PIE */}
                    <div className="mt-6 flex items-start gap-3 px-4 text-muted-foreground/60">
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed font-medium">
                            Al iniciar el turno, todas las ventas en efectivo se sumarán a este fondo. Asegúrate de contar el dinero físico antes de continuar.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}