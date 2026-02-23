"use client";

import * as React from "react";
import { useDashboard } from "./hooks/use-dashboard";
import { DashboardHeader } from "./components/dashboard-header";
import { KpiCard } from "./components/kpi-card";
import { OperationsSection } from "./components/operations-section";
import { TopProductsSection } from "./components/top-products-section";
import { TendenciaSection } from "./components/tendencia-section";
import {
  Handshake, AlertTriangle, Boxes, Wallet,
  TrendingUp, Activity, Truck, Store
} from "lucide-react";
import { formatNumber, formatMoney } from "@/lib/utils-format";
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

    // Siempre visible: Ganancia principal
    items.push({
      key: "ganancia-neta",
      title: displayedGananciaLabel,
      value: formatMoney(displayedGanancia),
      subtitle: "Utilidad Real (Venta - Costo)",
      icon: TrendingUp,
      loading,
      variant: "success",
      emphasis: true,
    });

    // Solo en "all": desglose por canal
    if (filter === "all") {
      items.push(
        {
          key: "ganancia-consig",
          title: "Ganancia por Consignación",
          value: formatMoney(gananciaConsig),
          subtitle: `${pctConsig}% del total`,
          icon: Truck,
          loading,
        },
        {
          key: "ganancia-pos",
          title: "Ganancia Local",
          value: formatMoney(gananciaPOS),
          subtitle: `${pctPOS}% del total`,
          icon: Store,
          loading,
        }
      );
    }

    // Ingresos Caja: visible en "all" y "pos"
    if (filter === "all" || filter === "pos") {
      items.push({
        key: "ingresos-caja",
        title: "Ingresos Caja",
        value: formatMoney(kpis?.finanzas?.pagos?.total ?? 0),
        subtitle: "Pagos procesados",
        icon: Wallet,
        loading,
      });
    }

    return items;
  }, [kpis, filter, loading, displayedGanancia, displayedGananciaLabel, gananciaConsig, gananciaPOS, pctConsig, pctPOS]);

  // Grid adaptativo: las tarjetas siempre llenan todo el ancho
  const gridCols = (count: number) =>
    cn(
      "grid gap-3 md:gap-6",
      count >= 4
        ? "grid-cols-2 lg:grid-cols-4"
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
          </div>
        </div>

        <div className="pt-4">
          <TendenciaSection trend={trend} period={period} loading={loading} filter={filter} />
        </div>
      </div>
    </div>
  );
}