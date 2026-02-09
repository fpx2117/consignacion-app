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
import type { DashboardPeriod } from "@/lib/types";

export default function DashboardPage() {
  const [period, setPeriod] = React.useState<DashboardPeriod>("month");
  const { kpis, consig, top, trend, loading, error, refresh } = useDashboard(period);

  // --- CÁLCULOS AUXILIARES PARA UI ---
  const gananciaTotal = kpis?.finanzas?.ganancia?.total ?? 0;
  const gananciaConsig = kpis?.finanzas?.ganancia?.porConsignacion ?? 0;
  const gananciaPOS = kpis?.finanzas?.ganancia?.porVentaDirecta ?? 0;

  // Calculamos porcentajes visuales (evitando división por cero)
  const pctConsig = gananciaTotal > 0 ? Math.round((gananciaConsig / gananciaTotal) * 100) : 0;
  const pctPOS = gananciaTotal > 0 ? Math.round((gananciaPOS / gananciaTotal) * 100) : 0;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 p-4 pb-32 md:p-8"> 
      
      <DashboardHeader 
        period={period} 
        setPeriod={setPeriod} 
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
        <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
          <KpiCard
            loading={loading}
            title="Consignaciones"
            value={formatNumber(kpis?.consignaciones?.abiertas ?? 0)}
            subtitle="Abiertas activas"
            icon={Handshake}
            emphasis={(kpis?.consignaciones?.abiertas ?? 0) > 0}
          />
          <KpiCard
            loading={loading}
            title="Pendientes"
            value={formatNumber(kpis?.consignacionUnits?.pendientes ?? 0)}
            subtitle="Units en clientes"
            icon={AlertTriangle}
            emphasis={(kpis?.consignacionUnits?.pendientes ?? 0) > 0}
            variant="destructive" // Rojo para alertar deuda de producto
          />
          <KpiCard
            loading={loading}
            title="En Calle"
            value={formatNumber(kpis?.stock?.consignadoUnits ?? 0)}
            subtitle="Stock consignado"
            icon={Boxes}
          />
          <KpiCard
            loading={loading}
            title="Saldo Global"
            value={formatMoney(kpis?.finanzas?.saldoClientesTotal ?? 0)}
            subtitle="Deuda acumulada"
            icon={Activity}
          />
        </div>

        {/* SECCIÓN 2: FINANZAS Y RENTABILIDAD */}
<h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1 pt-4">Rentabilidad</h3>
<div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
  
  {/* 1. GANANCIA NETA TOTAL -> VERDE */}
  <KpiCard
    loading={loading}
    title="Ganancia Neta"
    value={formatMoney(gananciaTotal)}
    subtitle="Utilidad Real (Venta - Costo)"
    icon={TrendingUp}
    variant="success" // ✅ Ahora sí se verá VERDE
    emphasis={true}   // ✅ Y tendrá sombra destacada
  />

  {/* 2. GANANCIA POR CONSIGNACIÓN -> CAMBIO DE NOMBRE */}
  <KpiCard
    loading={loading}
    title="Ganancia por Consignación" // ✅ Nombre actualizado
    value={formatMoney(gananciaConsig)}
    subtitle={`${pctConsig}% del total`}
    icon={Truck}
  />

  {/* 3. GANANCIA POS */}
  <KpiCard
    loading={loading}
    title="Ganancia Local"
    value={formatMoney(gananciaPOS)}
    subtitle={`${pctPOS}% del total`}
    icon={Store}
  />

  {/* 4. CAJA / COBRADO */}
  <KpiCard
    loading={loading}
    title="Ingresos Caja"
    value={formatMoney(kpis?.finanzas?.pagos?.total ?? 0)}
    subtitle="Pagos procesados"
    icon={Wallet}
  />
</div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-8">
           <OperationsSection consig={consig} loading={loading} />
        </div>
        <div className="space-y-8">
           <TopProductsSection top={top} loading={loading} />
        </div>
      </div>

      <div className="pt-4">
        <TendenciaSection trend={trend} period={period} loading={loading} />
      </div>
    </div>
  );
}