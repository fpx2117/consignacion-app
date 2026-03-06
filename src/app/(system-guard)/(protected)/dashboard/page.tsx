/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import { useDashboard } from "./hooks/use-dashboard";
import { DashboardHeader } from "./components/dashboard-header";
import { KpiCard } from "./components/kpi-card";
import { OperationsSection } from "./components/operations-section";
import { TopProductsSection } from "./components/top-products-section";
import { TendenciaSection } from "./components/tendencia-section";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  Handshake, AlertTriangle, Boxes, Wallet,
  TrendingUp, Activity, Truck, Store,
  Calendar, Receipt
} from "lucide-react";

import { formatNumber, formatMoney, formatDate } from "@/lib/utils-format";

import { DashboardPeriod, DashboardFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KpiConfig {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  loading: boolean;
  emphasis?: boolean;
  variant?: "default" | "success" | "destructive" | "warning";
}

export default function DashboardPage() {
  const [period, setPeriod] = React.useState<DashboardPeriod>("month");
  const [filter, setFilter] = React.useState<DashboardFilter>("all");
  const { kpis, consig, top, trend, loading, error, refresh } = useDashboard(period);

  // --- CÁLCULOS AUXILIARES ---
  const gananciaTotal = kpis?.finanzas?.ganancia?.total ?? 0;
  const gananciaConsig = kpis?.finanzas?.ganancia?.porConsignacion ?? 0;
  const gananciaPOS = kpis?.finanzas?.ganancia?.porVentaDirecta ?? 0;

  const pctConsig = gananciaTotal > 0 ? Math.round((gananciaConsig / gananciaTotal) * 100) : 0;
  const pctPOS = gananciaTotal > 0 ? Math.round((gananciaPOS / gananciaTotal) * 100) : 0;

  // Ganancia mostrada según filtro
  let displayedGanancia = gananciaTotal;
  let displayedGananciaLabel = "Ganancia Neta";

  if (filter === "consignacion") {
    displayedGanancia = gananciaConsig;
    displayedGananciaLabel = "Ganancia (Consignación)";
  } else if (filter === "pos") {
    displayedGanancia = gananciaPOS;
    displayedGananciaLabel = "Ganancia (Ventas Directas)";
  }

  // --- KPIs OPERATIVOS (array filtrado) ---
  const operativeKpis: KpiConfig[] = React.useMemo(() => {
    const items: KpiConfig[] = [];

    if (filter === "all" || filter === "consignacion") {
      items.push(
        {
          key: "consignaciones",
          title: "Consignaciones",
          value: formatNumber(kpis?.consignaciones?.abiertas ?? 0),
          subtitle: "Abiertas activas",
          icon: Handshake,
          loading,
          emphasis: (kpis?.consignaciones?.abiertas ?? 0) > 0,
        },
        {
          key: "pendientes",
          title: "Pendientes",
          value: formatNumber(kpis?.consignacionUnits?.pendientes ?? 0),
          subtitle: "Units en clientes",
          icon: AlertTriangle,
          loading,
          emphasis: (kpis?.consignacionUnits?.pendientes ?? 0) > 0,
          variant: "destructive",
        },
        {
          key: "en-calle",
          title: "En Calle",
          value: formatNumber(kpis?.stock?.consignadoUnits ?? 0),
          subtitle: "Stock consignado",
          icon: Boxes,
          loading,
        },
        {
          key: "saldo-global",
          title: "Saldo Global",
          value: formatMoney(kpis?.finanzas?.saldoClientesTotal ?? 0),
          subtitle: "Deuda acumulada",
          icon: Activity,
          loading,
        }
      );
    }

    if (filter === "pos") {
      items.push({
        key: "stock-local",
        title: "Stock Local",
        value: formatNumber(kpis?.stock?.disponibleUnits ?? 0),
        subtitle: "Unidades en depósito",
        icon: Boxes,
        loading,
      });
    }

    return items;
  }, [kpis, filter, loading]);

  // --- KPIs RENTABILIDAD (array filtrado) ---
  const financeKpis: KpiConfig[] = React.useMemo(() => {
    const items: KpiConfig[] = [];

    // Siempre visible: Ganancia principal (NETA)
    items.push({
      key: "ganancia-neta",
      title: "Ganancia Neta",
      value: formatMoney(displayedGanancia),
      subtitle: "Utilidad final (Bruta - Gastos)",
      icon: TrendingUp,
      loading,
      variant: "success",
      emphasis: true,
    });

    // Solo en "all": desglose por canal y Bruta/Gastos
    if (filter === "all") {
      items.push(
        {
          key: "ganancia-bruta",
          title: "Ganancia Bruta",
          value: formatMoney(kpis?.finanzas?.ganancia?.bruta ?? 0),
          subtitle: `Ventas - Costos`,
          icon: Activity,
          loading,
        },
        {
          key: "gastos-totales",
          title: "Gastos Totales",
          value: formatMoney(kpis?.finanzas?.ganancia?.gastos ?? 0),
          subtitle: `${kpis?.gastos?.cantidad ?? 0} registros pagados`,
          icon: Wallet,
          loading,
          variant: (kpis?.finanzas?.ganancia?.gastos ?? 0) > 0 ? "warning" : "default",
        }
      );
    }

    const usesCashControl = kpis?.usarControlDeCaja ?? true;

    if (usesCashControl) {
      // UNIFICADO: MOVIMIENTO TOTAL (Ingresos vs Facturación)
      let displayedVentas = kpis?.finanzas?.ventas?.total ?? 0;
      let displayedPagos = kpis?.finanzas?.pagos?.total ?? 0;
      let titleSuffix = "";

      if (filter === "pos") {
        displayedVentas = kpis?.finanzas?.ventas?.soloVenta ?? 0;
        displayedPagos = kpis?.finanzas?.pagos?.soloVenta ?? 0;
        titleSuffix = " (POS)";
      } else if (filter === "consignacion") {
        displayedVentas = kpis?.finanzas?.ventas?.soloConsig ?? 0;
        displayedPagos = kpis?.finanzas?.pagos?.soloDeuda ?? 0;
        titleSuffix = " (Consig)";
      }

      items.push({
        key: "movimiento-unificado",
        title: `Movimiento Total${titleSuffix}`,
        value: formatMoney(displayedPagos),
        subtitle: `Facturado: ${formatMoney(displayedVentas)}`,
        icon: Store,
        loading,
      });
    } else {
      // SOLO VENTAS: Cuando el control de caja está deshabilitado
      let displayedVentas = kpis?.finanzas?.ventas?.total ?? 0;
      let titleSuffix = "";

      if (filter === "pos") {
        displayedVentas = kpis?.finanzas?.ventas?.soloVenta ?? 0;
        titleSuffix = " POS";
      } else if (filter === "consignacion") {
        displayedVentas = kpis?.finanzas?.ventas?.soloConsig ?? 0;
        titleSuffix = " Consignación";
      }

      items.push({
        key: "ventas-solo",
        title: "Ventas",
        value: formatMoney(displayedVentas),
        subtitle: `Facturación total${titleSuffix}`,
        icon: Activity,
        loading,
      });
    }

    return items;
  }, [kpis, filter, loading, displayedGanancia]);

  // Grid adaptativo: las tarjetas siempre llenan todo el ancho
  const gridCols = (count: number) =>
    cn(
      "grid gap-3 md:gap-6",
      count >= 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : count === 3
          ? "grid-cols-1 sm:grid-cols-3"
          : count === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1"
    );

  return (
    <div className="relative min-h-screen w-full">
      <div className="mx-auto max-w-[1800px] space-y-8 p-4 pb-32 sm:p-6 md:p-8 lg:p-10">

        <DashboardHeader
          period={period}
          setPeriod={setPeriod}
          filter={filter}
          setFilter={setFilter}
          refresh={refresh}
          loading={loading}
        />

        {error && (
          <div className="flex items-center gap-3 p-4 text-sm text-destructive bg-destructive/5 border border-destructive/10 rounded-xl animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* SECCIÓN 1: OPERATIVIDAD Y RIESGO */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Estado Operativo</h3>
          <div className={gridCols(operativeKpis.length)}>
            {operativeKpis.map((kpi) => (
              <KpiCard
                key={kpi.key}
                loading={kpi.loading}
                title={kpi.title}
                value={kpi.value}
                subtitle={kpi.subtitle}
                icon={kpi.icon}
                emphasis={kpi.emphasis}
                variant={kpi.variant}
              />
            ))}
          </div>

          {/* SECCIÓN 2: FINANZAS Y RENTABILIDAD */}
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1 pt-4">Rentabilidad</h3>
          <div className={gridCols(financeKpis.length)}>
            {financeKpis.map((kpi) => (
              <KpiCard
                key={kpi.key}
                loading={kpi.loading}
                title={kpi.title}
                value={kpi.value}
                subtitle={kpi.subtitle}
                icon={kpi.icon}
                emphasis={kpi.emphasis}
                variant={kpi.variant}
              />
            ))}
          </div>
        </section>

        <div className={cn(
          "grid grid-cols-1 gap-8",
          (filter === "all" || filter === "consignacion") ? "lg:grid-cols-2" : ""
        )}>
          {(filter === "all" || filter === "consignacion") && (
            <div className="space-y-8">
              <OperationsSection consig={consig} loading={loading} />
            </div>
          )}
          <div className="space-y-8">
            <TopProductsSection top={top} loading={loading} filter={filter} />

            {/* PRÓXIMOS VENCIMIENTOS (GASTOS) */}
            {filter === "all" && (kpis?.proximosVencimientos?.length ?? 0) > 0 && (
              <Card className="rounded-[2rem] border-border/50 bg-card shadow-xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black">Próximos Vencimientos</CardTitle>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Gastos Pendientes</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {kpis?.proximosVencimientos.map((g: any) => (
                    <div key={g.id} className="flex items-center justify-between p-3.5 bg-muted/30 rounded-2xl border border-transparent hover:border-orange-500/20 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center shadow-sm">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-bold text-sm tracking-tight">{g.motivo}</div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-orange-600 uppercase">
                            <Calendar className="h-3 w-3" /> {formatDate(g.fechaVencimiento)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm">{formatMoney(Number(g.monto))}</div>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-md py-0 h-4 border-orange-500/30 text-orange-600">
                          {g.categoria?.nombre}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="pt-4">
          <TendenciaSection trend={trend} period={period} loading={loading} filter={filter} />
        </div>
      </div>
    </div>
  );
}