"use client";

import * as React from "react";
import { useDashboard } from "./hooks/use-dashboard";
import { DashboardHeader } from "./components/dashboard-header";
import { KpiCard } from "./components/kpi-card";
import { OperationsSection } from "./components/operations-section";
import { TopProductsSection } from "./components/top-products-section";
import dynamic from "next/dynamic";
// TendenciaSection contiene recharts — carga dinámica para no inflar el bundle inicial
const TendenciaSection = dynamic(
  () => import("./components/tendencia-section").then(m => m.TendenciaSection),
  { ssr: false, loading: () => <div className="rounded-xl border bg-card h-64 animate-pulse" /> }
);
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  Handshake, AlertTriangle, Boxes, Wallet,
  TrendingUp, Activity, Store,
  Calendar, Receipt, Settings2, GripVertical, RotateCcw, BarChart3, Check, X, Shield
} from "lucide-react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { formatNumber, formatMoney, formatDate } from "@/lib/utils-format";

import { DashboardPeriod, DashboardFilter } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSucursalStore } from "@/store/useSucursalStore";

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

type KpiSection = "operative" | "finance";
const KPI_PREFS_STORAGE_KEY = "dashboard-kpi-preferences-v1";

const mergeKpiOrder = (availableKeys: string[], preferredOrder: string[]) => {
  const available = new Set(availableKeys);
  const validPreferred = preferredOrder.filter((key) => available.has(key));
  const missing = availableKeys.filter((key) => !validPreferred.includes(key));
  return [...validPreferred, ...missing];
};

function SortableKpiCard({ kpi }: { kpi: KpiConfig }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: kpi.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative h-full w-full will-change-transform", isDragging && "z-40 opacity-80")}
    >
      <button
        type="button"
        aria-label={`Mover KPI ${kpi.title}`}
        className="touch-none absolute right-3 top-3 z-30 inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <KpiCard
        loading={kpi.loading}
        title={kpi.title}
        value={kpi.value}
        subtitle={kpi.subtitle}
        icon={kpi.icon}
        emphasis={kpi.emphasis}
        variant={kpi.variant}
      />
    </div>
  );
}

function SortableKpiGrid({
  items,
  className,
  onReorder,
}: {
  items: KpiConfig[];
  className: string;
  onReorder: (keys: string[]) => void;
}) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 14 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = React.useMemo(() => items.map((item) => item.key), [items]);
  const activeKpi = React.useMemo(
    () => items.find((item) => item.key === activeId) ?? null,
    [activeId, items]
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));

    if (oldIndex < 0 || newIndex < 0) return;

    onReorder(arrayMove(ids, oldIndex, newIndex));
  }, [ids, onReorder]);

  const handleDragCancel = React.useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={cn(className, "items-stretch") }>
          {items.map((kpi) => (
            <SortableKpiCard key={kpi.key} kpi={kpi} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeKpi ? (
          <div className="w-[min(100vw-2rem,420px)] rotate-1 opacity-95">
            <KpiCard
              loading={activeKpi.loading}
              title={activeKpi.title}
              value={activeKpi.value}
              subtitle={activeKpi.subtitle}
              icon={activeKpi.icon}
              emphasis={activeKpi.emphasis}
              variant={activeKpi.variant}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KpiToggleMenuItem({
  label,
  checked,
  onChange,
  checkedLabel = "Activo",
  uncheckedLabel = "Oculto",
}: {
  label: string;
  checked: boolean;
  onChange: (nextValue: boolean) => void;
  checkedLabel?: string;
  uncheckedLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30",
        checked ? "bg-[color:var(--status-success-strong)]/10" : "bg-transparent"
      )}
    >
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
          checked
            ? "border-[color:var(--status-success-strong)]/30 bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]"
            : "border-border bg-muted/50 text-muted-foreground"
        )}
      >
        {checked ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {checked ? checkedLabel : uncheckedLabel}
      </span>
    </button>
  );
}

export default function DashboardPage() {
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const [period, setPeriod] = React.useState<DashboardPeriod>("month");
  const [filter, setFilter] = React.useState<DashboardFilter>("all");
  const [showSensitiveData, setShowSensitiveData] = React.useState(false);
  const [hiddenKpis, setHiddenKpis] = React.useState<Record<string, boolean>>({});
  const [kpiOrder, setKpiOrder] = React.useState<Record<KpiSection, string[]>>({
    operative: [],
    finance: [],
  });
  const [prefsLoaded, setPrefsLoaded] = React.useState(false);
  const { kpis, consig, top, trend, loading, error, refresh } = useDashboard(period);
  const ventasStats = kpis?.finanzas?.ventas as { total?: number; soloVenta?: number; soloConsig?: number } | undefined;
  const pagosStats = kpis?.finanzas?.pagos as { total?: number; soloVenta?: number; soloDeuda?: number } | undefined;

  const storageKey = React.useMemo(() => {
    const suffix = activeSucursalId ?? "global";
    return `${KPI_PREFS_STORAGE_KEY}-${suffix}`;
  }, [activeSucursalId]);

  const maskMoney = React.useCallback((value: number) => {
    return showSensitiveData ? formatMoney(value) : "••••••";
  }, [showSensitiveData]);

  React.useEffect(() => {
    setPrefsLoaded(false);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setShowSensitiveData(false);
        setHiddenKpis({});
        setKpiOrder({ operative: [], finance: [] });
        setPrefsLoaded(true);
        return;
      }

      const parsed = JSON.parse(raw);
      setShowSensitiveData(Boolean(parsed?.showSensitiveData));
      setHiddenKpis(parsed?.hiddenKpis ?? {});
      setKpiOrder({
        operative: parsed?.kpiOrder?.operative ?? [],
        finance: parsed?.kpiOrder?.finance ?? [],
      });
    } catch {
      setShowSensitiveData(false);
      setHiddenKpis({});
      setKpiOrder({ operative: [], finance: [] });
    } finally {
      setPrefsLoaded(true);
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (!prefsLoaded) return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ showSensitiveData, hiddenKpis, kpiOrder })
    );
  }, [showSensitiveData, hiddenKpis, kpiOrder, prefsLoaded, storageKey]);

  // --- CÁLCULOS AUXILIARES ---
  const gananciaTotal = kpis?.finanzas?.ganancia?.total ?? 0;
  const gananciaConsig = kpis?.finanzas?.ganancia?.porConsignacion ?? 0;
  const gananciaPOS = kpis?.finanzas?.ganancia?.porVentaDirecta ?? 0;

  // Ganancia mostrada según filtro
  let displayedGanancia = gananciaTotal;

  if (filter === "consignacion") {
    displayedGanancia = gananciaConsig;
  } else if (filter === "pos") {
    displayedGanancia = gananciaPOS;
  }

  // --- KPIs OPERATIVOS (array filtrado) ---
  const operativeKpis: KpiConfig[] = React.useMemo(() => {
    const items: KpiConfig[] = [
      {
        key: "catalogo-visitas",
        title: "Visitas Catalogo",
        value: formatNumber(kpis?.catalogo?.visitas ?? 0),
        subtitle: `${formatNumber(kpis?.catalogo?.visitantesUnicos ?? 0)} visitantes unicos`,
        icon: Store,
        loading,
      },
    ];

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
          value: maskMoney(kpis?.finanzas?.saldoClientesTotal ?? 0),
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
  }, [kpis, filter, loading, maskMoney]);

  // --- KPIs RENTABILIDAD (array filtrado) ---
  const financeKpis: KpiConfig[] = React.useMemo(() => {
    const items: KpiConfig[] = [];

    // Siempre visible: Ganancia principal (NETA)
    items.push({
      key: "ganancia-neta",
      title: "Ganancia Neta",
      value: maskMoney(displayedGanancia),
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
          value: maskMoney(kpis?.finanzas?.ganancia?.bruta ?? 0),
          subtitle: `Ventas - Costos`,
          icon: Activity,
          loading,
        },
        {
          key: "gastos-totales",
          title: "Gastos Totales",
          value: maskMoney(kpis?.finanzas?.ganancia?.gastos ?? 0),
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
      let displayedVentas = ventasStats?.total ?? 0;
      let displayedPagos = pagosStats?.total ?? 0;
      let titleSuffix = "";

      if (filter === "pos") {
        displayedVentas = ventasStats?.soloVenta ?? 0;
        displayedPagos = pagosStats?.soloVenta ?? 0;
        titleSuffix = " (POS)";
      } else if (filter === "consignacion") {
        displayedVentas = ventasStats?.soloConsig ?? 0;
        displayedPagos = pagosStats?.soloDeuda ?? 0;
        titleSuffix = " (Consig)";
      }

      items.push({
        key: "movimiento-unificado",
        title: `Movimiento Total${titleSuffix}`,
        value: maskMoney(displayedPagos),
        subtitle: `Facturado: ${maskMoney(displayedVentas)}`,
        icon: Store,
        loading,
      });
    } else {
      // SOLO VENTAS: Cuando el control de caja está deshabilitado
      let displayedVentas = ventasStats?.total ?? 0;
      let titleSuffix = "";

      if (filter === "pos") {
        displayedVentas = ventasStats?.soloVenta ?? 0;
        titleSuffix = " POS";
      } else if (filter === "consignacion") {
        displayedVentas = ventasStats?.soloConsig ?? 0;
        titleSuffix = " Consignación";
      }

      items.push({
        key: "ventas-solo",
        title: "Ventas",
        value: maskMoney(displayedVentas),
        subtitle: `Facturación total${titleSuffix}`,
        icon: Activity,
        loading,
      });
    }

    return items;
  }, [kpis, filter, loading, displayedGanancia, maskMoney, ventasStats, pagosStats]);

  const allVisibleKpis = React.useMemo(
    () => [...operativeKpis, ...financeKpis],
    [operativeKpis, financeKpis]
  );

  const visibleKpiCount = React.useMemo(() => {
    return allVisibleKpis.filter((kpi) => !hiddenKpis[kpi.key]).length;
  }, [allVisibleKpis, hiddenKpis]);

  const visibleOperativeCount = React.useMemo(() => {
    return operativeKpis.filter((kpi) => !hiddenKpis[kpi.key]).length;
  }, [operativeKpis, hiddenKpis]);

  const visibleFinanceCount = React.useMemo(() => {
    return financeKpis.filter((kpi) => !hiddenKpis[kpi.key]).length;
  }, [financeKpis, hiddenKpis]);

  const orderedOperativeKpis = React.useMemo(() => {
    const byKey = new Map(operativeKpis.map((item) => [item.key, item]));
    const orderedKeys = mergeKpiOrder(
      operativeKpis.map((item) => item.key),
      kpiOrder.operative
    );

    return orderedKeys
      .filter((key) => !hiddenKpis[key])
      .map((key) => byKey.get(key))
      .filter(Boolean) as KpiConfig[];
  }, [operativeKpis, hiddenKpis, kpiOrder.operative]);

  const orderedFinanceKpis = React.useMemo(() => {
    const byKey = new Map(financeKpis.map((item) => [item.key, item]));
    const orderedKeys = mergeKpiOrder(
      financeKpis.map((item) => item.key),
      kpiOrder.finance
    );

    return orderedKeys
      .filter((key) => !hiddenKpis[key])
      .map((key) => byKey.get(key))
      .filter(Boolean) as KpiConfig[];
  }, [financeKpis, hiddenKpis, kpiOrder.finance]);

  const handleToggleKpi = React.useCallback((key: string, checked: boolean) => {
    setHiddenKpis((prev) => {
      const next = { ...prev };
      if (checked) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  }, []);

  const handleReorder = React.useCallback(
    (section: KpiSection, reorderedVisibleKeys: string[], sourceKpis: KpiConfig[]) => {
      setKpiOrder((prev) => {
        const availableKeys = sourceKpis.map((item) => item.key);
        const baseOrder = mergeKpiOrder(availableKeys, prev[section]);
        const hiddenKeys = baseOrder.filter((key) => hiddenKpis[key]);
        return {
          ...prev,
          [section]: [...reorderedVisibleKeys, ...hiddenKeys],
        };
      });
    },
    [hiddenKpis]
  );

  const resetKpiLayout = React.useCallback(() => {
    setHiddenKpis({});
    setKpiOrder({ operative: [], finance: [] });
  }, []);

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

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:text-foreground hover:bg-muted/40"
                aria-label="Personalizar KPIs"
              >
                <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Settings2 className="h-3.5 w-3.5" />
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                    {visibleKpiCount}
                  </span>
                </span>
                <span>Personalizar KPIs</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
              <SheetHeader className="border-b border-border/60 bg-gradient-to-b from-primary/10 to-transparent px-4 pb-3 pt-4">
                <div className="flex items-start justify-between gap-2 pr-8">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Settings2 className="h-4 w-4" />
                    </span>
                    <div>
                      <SheetTitle className="text-sm font-bold">Personalizar KPIs</SheetTitle>
                      <SheetDescription className="mt-0.5 text-[11px]">
                        Activa o desactiva tarjetas del dashboard segun lo que quieras ver.
                      </SheetDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-full text-[10px] font-bold">
                    {visibleKpiCount}/{allVisibleKpis.length || 0}
                  </Badge>
                </div>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="space-y-3 p-3">
                  <section className="rounded-xl border border-border/60 bg-card/40 p-2">
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Shield className="h-3 w-3" /> Privacidad
                      </div>
                    </div>
                    <KpiToggleMenuItem
                      label="Mostrar datos sensibles"
                      checked={showSensitiveData}
                      onChange={setShowSensitiveData}
                      checkedLabel="Visible"
                      uncheckedLabel="Oculto"
                    />
                  </section>

                  <section className="rounded-xl border border-border/60 bg-card/40 p-2">
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Activity className="h-3 w-3" /> Estado Operativo
                      </div>
                      <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[9px]">{visibleOperativeCount}/{operativeKpis.length}</Badge>
                    </div>
                    {operativeKpis.map((item) => (
                      <KpiToggleMenuItem
                        key={`toggle-${item.key}`}
                        checked={!hiddenKpis[item.key]}
                        onChange={(next) => handleToggleKpi(item.key, next)}
                        label={item.title}
                      />
                    ))}
                  </section>

                  <section className="rounded-xl border border-border/60 bg-card/40 p-2">
                    <div className="mb-1.5 flex items-center justify-between px-1">
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <BarChart3 className="h-3 w-3" /> Rentabilidad
                      </div>
                      <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[9px]">{visibleFinanceCount}/{financeKpis.length}</Badge>
                    </div>
                    {financeKpis.map((item) => (
                      <KpiToggleMenuItem
                        key={`toggle-${item.key}`}
                        checked={!hiddenKpis[item.key]}
                        onChange={(next) => handleToggleKpi(item.key, next)}
                        label={item.title}
                      />
                    ))}
                  </section>
                </div>
              </ScrollArea>

              <SheetFooter className="border-t border-border/60 bg-background/90 p-3">
                <button
                  type="button"
                  onClick={resetKpiLayout}
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted/70"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restablecer distribucion
                </button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 text-sm text-destructive bg-destructive/5 border border-destructive/10 rounded-xl animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* SECCIÓN 1: OPERATIVIDAD Y RIESGO */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1">Estado Operativo</h3>
          {orderedOperativeKpis.length > 0 ? (
            <SortableKpiGrid
              items={orderedOperativeKpis}
              className={gridCols(orderedOperativeKpis.length)}
              onReorder={(keys) => handleReorder("operative", keys, operativeKpis)}
            />
          ) : (
            <Card className="border-dashed border-border/60 bg-card/60">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No hay KPIs visibles en esta sección.
              </CardContent>
            </Card>
          )}

          {/* SECCIÓN 2: FINANZAS Y RENTABILIDAD */}
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest pl-1 pt-4">Rentabilidad</h3>
          {orderedFinanceKpis.length > 0 ? (
            <SortableKpiGrid
              items={orderedFinanceKpis}
              className={gridCols(orderedFinanceKpis.length)}
              onReorder={(keys) => handleReorder("finance", keys, financeKpis)}
            />
          ) : (
            <Card className="border-dashed border-border/60 bg-card/60">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No hay KPIs visibles en esta sección.
              </CardContent>
            </Card>
          )}
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
                    <div className="h-10 w-10 rounded-2xl bg-[color:var(--status-warning)]/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-[color:var(--status-warning)]" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black">Próximos Vencimientos</CardTitle>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Gastos Pendientes</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {kpis?.proximosVencimientos.map((g) => (
                    <div key={g.id} className="flex items-center justify-between p-3.5 bg-muted/30 rounded-2xl border border-transparent hover:border-[color:var(--status-warning)]/20 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center shadow-sm">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-bold text-sm tracking-tight">{g.motivo}</div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-[color:var(--status-warning)] uppercase">
                            <Calendar className="h-3 w-3" /> {formatDate(g.fechaVencimiento)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm">{maskMoney(Number(g.monto))}</div>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-md py-0 h-4 border-[color:var(--status-warning)]/30 text-[color:var(--status-warning)]">
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
