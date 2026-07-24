"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Banknote,
  AlertCircle,
  CreditCard,
  Calculator,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { apiService } from "@/lib/apiService";
import type { SesionCaja } from "@/lib/types";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function CerrarCajaPage() {
  const router = useRouter();

  const [sesion, setSesion] = React.useState<SesionCaja | null>(null);
  const [montoFinalReal, setMontoFinalReal] = React.useState<string>("");
  const [observaciones, setObservaciones] = React.useState<string>("");

  const [loadingData, setLoadingData] = React.useState(true);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resultadoCierre, setResultadoCierre] =
    React.useState<SesionCaja | null>(null);

  React.useEffect(() => {
    const cargarDatos = async () => {
      try {
        const res = await apiService.verificarCajaAbierta();
        const sesionData = res?.data ?? null;
        if (!sesionData) {
          setError("No tienes un turno abierto actualmente.");
        } else {
          setSesion(sesionData);
        }
      } catch (err: unknown) {
        setError(
          "Error al cargar datos del turno: " +
            (err instanceof Error ? err.message : "Error desconocido"),
        );
      } finally {
        setLoadingData(false);
      }
    };
    cargarDatos();
  }, []);

  const balance = React.useMemo(() => {
    if (!sesion) return null;

    const fondoInicial = Number(sesion.montoInicial);
    const ventasEfectivo =
      sesion.ventas
        ?.filter((v) => v.metodoPago === "EFECTIVO")
        .reduce((acc, v) => acc + Number(v.total), 0) ?? 0;
    const cobranzasEfectivo =
      sesion.pagos
        ?.filter((p) => p.metodo === "EFECTIVO")
        .reduce((acc, p) => acc + Number(p.monto), 0) ?? 0;
    const ventasDigital =
      sesion.ventas
        ?.filter((v) => v.metodoPago !== "EFECTIVO")
        .reduce((acc, v) => acc + Number(v.total), 0) ?? 0;
    const cobranzasDigital =
      sesion.pagos
        ?.filter((p) => p.metodo !== "EFECTIVO")
        .reduce((acc, p) => acc + Number(p.monto), 0) ?? 0;
    const ingresos =
      sesion.movimientos
        ?.filter((m) => m.tipo === "INGRESO")
        .reduce((acc, m) => acc + Number(m.monto), 0) ?? 0;
    const egresos =
      sesion.movimientos
        ?.filter((m) => m.tipo === "EGRESO")
        .reduce((acc, m) => acc + Number(m.monto), 0) ?? 0;

    const efectivoEsperado =
      fondoInicial + ventasEfectivo + cobranzasEfectivo + ingresos - egresos;
    const digitalTotal = ventasDigital + cobranzasDigital;

    return {
      fondoInicial,
      ventasEfectivo,
      cobranzasEfectivo,
      ingresos,
      egresos,
      efectivoEsperado,
      digitalTotal,
    };
  }, [sesion]);

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    setMontoFinalReal(rawValue);
  };

  const handleCerrarCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sesion) return;
    setLoadingSubmit(true);

    try {
      const res = await apiService.cerrarCaja({
        sesionId: sesion.id,
        montoReal: Number(montoFinalReal),
        observaciones: observaciones || undefined,
      });

      const dataCierre = res.data?.data ?? res.data;
      const diferencia = Number(dataCierre?.diferencia || 0);

      // ✅ REDIRECCIÓN AUTOMÁTICA SI COINCIDEN (DIFERENCIA 0)
      if (diferencia === 0) {
        toast.success("Caja cerrada perfectamente. Redirigiendo...");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        // Si hay diferencia, mostramos la pantalla de resumen
        setResultadoCierre(dataCierre);
        toast.warning("Turno cerrado con diferencias en el arqueo.");
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al cerrar la caja",
      );
    } finally {
      setLoadingSubmit(false);
    }
  };

  if (loadingData) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-background space-y-4">
        <Loader2 className="animate-spin text-[color:var(--primary)] h-8 w-8" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Sincronizando auditoría...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="h-16 w-16 bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)] rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Caja No Detectada</h2>
        <p className="text-muted-foreground mb-6 max-w-xs">{error}</p>
        <Button
          className="w-full max-w-[200px] rounded-xl bg-[color:var(--primary)]"
          onClick={() => router.back()}
        >
          Volver
        </Button>
      </div>
    );
  }

  // PANTALLA DE RESUMEN (Solo si hubo diferencia)
  if (resultadoCierre) {
    const diferencia = Number(resultadoCierre.diferencia || 0);
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md p-8 md:p-10 rounded-[2.5rem] shadow-2xl space-y-8 text-center border-border/40 bg-card relative overflow-hidden animate-in zoom-in-95 duration-500">
          <div
            className={cn(
              "absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl opacity-20",
              diferencia < 0
                ? "bg-[color:var(--status-danger)]"
                : "bg-[color:var(--theme-ocean-primary)]",
            )}
          />
          <div className="relative z-10 flex flex-col items-center">
            <div className="h-20 w-20 rounded-2xl bg-[color:var(--status-warning)] text-[color:var(--ui-fx-white)] flex items-center justify-center shadow-lg mb-6 rotate-3">
              <AlertCircle className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">
              Arqueo con Diferencia
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              El monto contado no coincide con el sistema.
            </p>
          </div>

          <div className="relative z-10 p-6 bg-muted/30 border border-border/40 rounded-[1.5rem] space-y-3.5 font-medium text-sm">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Esperado:</span>
              <span className="font-bold text-foreground">
                {formatCurrency(Number(resultadoCierre.montoFinalEsperado))}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Declarado:</span>
              <span className="font-bold text-foreground">
                {formatCurrency(Number(resultadoCierre.montoFinalReal))}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-dashed border-border/60 pt-4 text-lg font-black mt-2">
              <span>Diferencia:</span>
              <span
                className={
                  diferencia < 0
                    ? "text-[color:var(--status-danger)]"
                    : "text-[color:var(--theme-ocean-primary)]"
                }
              >
                {diferencia > 0 ? "+" : ""}
                {formatCurrency(diferencia)}
              </span>
            </div>
          </div>

          <Button
            className="relative z-10 w-full h-14 rounded-xl bg-foreground text-background font-bold text-base"
            onClick={() => router.push("/dashboard")}
          >
            Confirmar e Ir al Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col selection:bg-[color:var(--primary)]/20 pb-10">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full h-10 w-10 border-border/50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-tight leading-none uppercase">
              Cierre de Arqueo
            </h1>
            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.1em] mt-1">
              Sesión Activa
            </span>
          </div>
        </div>
        {sesion && (
          <div className="bg-[color:var(--primary)]/10 text-[color:var(--primary)] px-3 py-1.5 rounded-full border border-[color:var(--primary)]/20 flex items-center gap-2">
            <Store className="h-3.5 w-3.5" />
            <span className="text-[10px] font-black uppercase">
              Caja #{sesion.cajaId}
            </span>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto w-full p-4 md:p-8 grid lg:grid-cols-2 gap-8 md:gap-12 mt-2">
        {/* IZQUIERDA: RESUMEN DEL SISTEMA */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight">
              Estado de{" "}
              <span className="text-[color:var(--primary)]">Caja</span>
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              Totales calculados según registros del sistema.
            </p>
          </div>

          <Card className="rounded-[2rem] border-border/40 overflow-hidden shadow-sm">
            <div className="p-5 border-b bg-muted/10 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
              <Banknote className="h-4 w-4 text-[color:var(--primary)]" />{" "}
              Efectivo en Sistema
            </div>
            <div className="p-8 space-y-5 text-sm">
              <div className="flex justify-between items-center text-muted-foreground font-medium">
                <span>Fondo Inicial:</span>
                <span className="text-foreground">
                  {formatCurrency(balance?.fondoInicial || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[color:var(--status-success-strong)] font-bold">
                <span>Ingresos (Ventas/Cobros):</span>
                <span>
                  +
                  {formatCurrency(
                    (balance?.ventasEfectivo || 0) +
                      (balance?.cobranzasEfectivo || 0),
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center text-[color:var(--theme-ocean-primary)] font-bold">
                <span>Movimientos Manuales:</span>
                <span>
                  {formatCurrency(
                    (balance?.ingresos || 0) - (balance?.egresos || 0),
                  )}
                </span>
              </div>
              <div className="pt-6 border-t border-dashed flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Total Esperado
                  </span>
                  <p className="text-5xl font-black text-[color:var(--primary)] tracking-tighter">
                    {formatCurrency(balance?.efectivoEsperado || 0)}
                  </p>
                </div>
                <Calculator className="h-10 w-10 text-[color:var(--primary)]/10 mb-1" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-[1.5rem] border-border/40 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-[color:var(--primary)] tracking-widest flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5" /> Dinero Digital
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                Transferencias y Tarjetas (No afecta arqueo físico)
              </p>
            </div>
            <span className="text-xl font-black">
              {formatCurrency(balance?.digitalTotal || 0)}
            </span>
          </Card>
        </section>

        {/* DERECHA: ENTRADA DEL CAJERO */}
        <section className="space-y-6">
          <Card className="rounded-[2.5rem] p-8 md:p-10 shadow-xl border-border/40">
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">
                  Efectivo Físico Contado
                </label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={
                      montoFinalReal
                        ? new Intl.NumberFormat("es-AR").format(
                            Number(montoFinalReal),
                          )
                        : ""
                    }
                    onChange={handleMontoChange}
                    className="h-24 md:h-28 pl-14 text-center text-5xl font-black rounded-3xl bg-muted/30 border-border/50 focus-visible:ring-[color:var(--primary)]/20"
                    placeholder="0"
                  />
                </div>
              </div>

              {montoFinalReal && balance && (
                <div
                  className={cn(
                    "p-5 rounded-2xl border flex items-center justify-between animate-in fade-in zoom-in-95",
                    Number(montoFinalReal) === balance.efectivoEsperado
                      ? "bg-[color:var(--status-success-strong)]/10 border-[color:var(--status-success-strong)]/20 text-[color:var(--status-success-strong)]"
                      : "bg-[color:var(--status-danger)]/10 border-[color:var(--status-danger)]/20 text-[color:var(--status-danger)]",
                  )}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase opacity-70">
                      Diferencia
                    </span>
                    <span className="text-xl font-black">
                      {formatCurrency(
                        Number(montoFinalReal) - balance.efectivoEsperado,
                      )}
                    </span>
                  </div>
                  <Badge
                    className={
                      Number(montoFinalReal) === balance.efectivoEsperado
                        ? "bg-[color:var(--status-success-strong)]"
                        : "bg-[color:var(--status-danger)]"
                    }
                  >
                    {Number(montoFinalReal) === balance.efectivoEsperado
                      ? "CAJA CUADRADA"
                      : "DESCUADRE"}
                  </Badge>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">
                  Observaciones
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full min-h-[100px] rounded-2xl bg-muted/30 border border-border/50 p-4 text-sm font-medium focus:ring-[color:var(--primary)]/20 outline-none"
                  placeholder="Justifica cualquier diferencia aquí..."
                />
              </div>

              <Button
                onClick={handleCerrarCaja}
                disabled={loadingSubmit || !montoFinalReal}
                className="w-full h-16 rounded-2xl bg-[color:var(--primary)] hover:bg-[color:var(--primary)] text-lg font-black shadow-lg shadow-violet-500/25 transition-all active:scale-95"
              >
                {loadingSubmit ? (
                  <Loader2 className="animate-spin h-6 w-6" />
                ) : (
                  "Confirmar y Cerrar Turno"
                )}
              </Button>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
