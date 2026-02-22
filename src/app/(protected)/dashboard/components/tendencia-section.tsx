"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/utils-format";
import { DashboardTendencia, DashboardFilter } from "@/lib/types";
import { TrendingUp, DollarSign, Activity, Calendar, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface TendenciaSectionProps {
  trend: DashboardTendencia | null;
  period: string;
  loading: boolean;
  filter?: DashboardFilter;
}

export function TendenciaSection({ trend, period, loading, filter = "all" }: TendenciaSectionProps) {
  // --- 1. HOOKS SIEMPRE AL PRINCIPIO ---
  const [metric, setMetric] = React.useState<"amounts" | "counts">("amounts");
  const [selectedMonth, setSelectedMonth] = React.useState<string>("all");

  // Lógica de filtrado reactiva
  const chartData = React.useMemo(() => {
    // Si no hay datos o el periodo es "all", devolvemos array vacío pero el hook se ejecuta
    if (!trend || period === "all") return [];

    let data = [...trend.series];

    if (selectedMonth !== "all") {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      data = data.filter((day) => {
        const date = new Date(day.date);
        if (selectedMonth === "current") {
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        }
        if (selectedMonth === "prev") {
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const yearOfLastMonth = currentMonth === 0 ? currentYear - 1 : currentYear;
          return date.getMonth() === lastMonth && date.getFullYear() === yearOfLastMonth;
        }
        return true;
      });
    }

    return data.map((day) => ({
      ...day,
      formattedDate: new Date(day.date).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
      }),
    }));
  }, [trend, selectedMonth, period]);

  // --- 2. VALIDACIONES DE RENDERIZADO (DESPUÉS DE LOS HOOKS) ---

  // Si es "all", mostramos un estado informativo en lugar de romper el flujo
  if (period === "all") {
    return (
      <Card className="border-none shadow-sm bg-card/50 backdrop-blur-md overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
            <BarChart3 className="h-6 w-6 text-primary/40" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Tendencia no disponible</h3>
          <p className="text-xs text-muted-foreground max-w-[250px] mt-1 leading-relaxed">
            El gráfico detallado está optimizado para rangos de tiempo específicos. Selecciona hoy, esta semana o este mes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 px-1 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Análisis de Tendencia</h3>
            <p className="text-[12px] text-muted-foreground">Flujo operativo diario</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] h-8 text-[11px] bg-background">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el periodo</SelectItem>
              <SelectItem value="current">Mes Actual</SelectItem>
              <SelectItem value="prev">Mes Anterior</SelectItem>
            </SelectContent>
          </Select>

          <Tabs
            value={metric}
            onValueChange={(v: string) => setMetric(v as "amounts" | "counts")}
          >
            <TabsList className="h-8">
              <TabsTrigger value="amounts" className="text-[11px] gap-1.5">
                <DollarSign className="h-3 w-3" /> Montos
              </TabsTrigger>
              <TabsTrigger value="counts" className="text-[11px] gap-1.5">
                <Activity className="h-3 w-3" /> Cantidad
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-card/50 backdrop-blur-md overflow-hidden">
        <CardContent className="p-0 pt-6">
          {loading ? (
            <div className="px-6 pb-6"><Skeleton className="h-[300px] w-full rounded-xl" /></div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
              <Calendar className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No hay datos para esta selección</p>
            </div>
          ) : (
            <div className="h-[350px] w-full px-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/30" />

                  <XAxis
                    dataKey="formattedDate"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    className="fill-muted-foreground"
                    minTickGap={25}
                  />

                  <YAxis hide domain={['auto', 'auto']} />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-white/20 bg-black/60 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 mb-3">
                            {new Date(data.date).toLocaleDateString("es-AR", { dateStyle: 'long' })}
                          </p>
                          <div className="space-y-2">
                            {metric === "amounts" ? (
                              <>
                                {(filter === "all" || filter === "pos") && (
                                  <MetricRow label="Ventas" value={formatMoney(data.ventasTotal)} color="bg-primary" />
                                )}
                                {(filter === "all" || filter === "pos") && (
                                  <MetricRow label="Pagos" value={formatMoney(data.pagosTotal)} color="bg-emerald-500" highlight />
                                )}
                                {/* Si filtran por consignación, tal vez mostrar liquidaciones en montos? No tenemos monto de liquidación en tendencia point por ahora, solo count liquidaciones */}
                              </>
                            ) : (
                              <>
                                {(filter === "all" || filter === "consignacion") && (
                                  <MetricRow label="Consignaciones" value={data.consignaciones} color="bg-primary" />
                                )}
                                {(filter === "all" || filter === "consignacion") && (
                                  <MetricRow label="Liquidaciones" value={data.liquidaciones} color="bg-emerald-500" />
                                )}
                                {(filter === "all" || filter === "pos") && (
                                  <MetricRow label="Ventas (Q)" value={data.ventasCount} color="bg-blue-500" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* AREAS DEPENDIENDO DEL METRIC Y FILTER */}
                  {metric === "amounts" ? (
                    <>
                      {(filter === "all" || filter === "pos") && (
                        <Area
                          type="monotone"
                          dataKey="ventasTotal"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#colorPrimary)"
                          animationDuration={1500}
                        />
                      )}
                      {(filter === "all" || filter === "pos") && (
                        <Area
                          type="monotone"
                          dataKey="pagosTotal"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#colorSuccess)"
                          animationDuration={1500}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {/* COUNTS */}
                      {(filter === "all" || filter === "consignacion") && (
                        <Area
                          type="monotone"
                          dataKey="consignaciones"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#colorPrimary)"
                          animationDuration={1500}
                        />
                      )}
                      {(filter === "all" || filter === "consignacion") && (
                        <Area
                          type="monotone"
                          dataKey="liquidaciones"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#colorSuccess)"
                          animationDuration={1500}
                        />
                      )}
                      {(filter === "all" || filter === "pos") && filter !== "all" && (
                        <Area // Si solo es POS, mostramos count ventas
                          type="monotone"
                          dataKey="ventasCount"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#colorBlue)"
                          animationDuration={1500}
                        />
                      )}
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function MetricRow({ label, value, color, highlight }: { label: string, value: string | number, color: string, highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex items-center gap-2">
        <div className={cn("h-1.5 w-1.5 rounded-full", color)} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <span className={cn("text-xs font-bold", highlight && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </span>
    </div>
  );
}