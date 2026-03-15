"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatMoney } from "@/lib/utils-format";
import { motion } from "motion/react";
import { TrendingUp, Package } from "lucide-react";
import { cn } from "@/lib/utils";

import { DashboardFilter, DashboardTopConsignados, DashboardTopProductos, DashboardTopVendidos } from "@/lib/types";

type ProductRowProps = {
  rank: number;
  name: string;
  detailMain: string;
  detailSub: string;
  index: number;
};

type TopProductsSectionProps = {
  top?: DashboardTopProductos | null;
  loading: boolean;
  filter?: DashboardFilter;
};

export function TopProductsSection({ top, loading, filter = "all" }: TopProductsSectionProps) {

  const ProductRow = ({ rank, name, detailMain, detailSub, index }: ProductRowProps) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
        <div
          className="group rounded-2xl border border-border/55 bg-gradient-to-br from-card/70 via-card/50 to-card/35 p-3 sm:p-3.5 transition-all duration-300 ease-out hover:border-primary/25 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_14px_30px_rgba(0,0,0,0.32)] backdrop-blur-md"
        >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
          {/* Ranking */}
          <div className={cn(
            "relative flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl text-sm sm:text-lg font-black transition-colors shadow-inner",
            index === 0 ? "bg-[color:var(--status-warning)]/18 text-[color:var(--status-warning)] ring-1 ring-[color:var(--status-warning)]/35" :
              index === 1 ? "bg-muted/60 text-muted-foreground dark:bg-muted dark:text-muted-foreground/80" :
                index === 2 ? "bg-[color:var(--status-warning)]/14 text-[color:var(--status-warning)] ring-1 ring-[color:var(--status-warning)]/25" :
                  "bg-muted/35 text-muted-foreground/80 dark:bg-card dark:text-muted-foreground"
          )}>
            {rank}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 min-w-0">
            <div className="min-w-0">
              <p className="truncate text-sm sm:text-[15px] font-bold text-foreground/90 group-hover:text-primary transition-colors">
                {name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 bg-muted/50 px-1.5 rounded-sm">
                  Producto
                </span>
              </div>
            </div>

            <div className="text-right pl-1">
              <p className="text-sm sm:text-base font-black tabular-nums tracking-tight leading-none">{detailMain}</p>
              <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground whitespace-nowrap">{detailSub}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const showVentas = filter === "all" || filter === "pos";
  const showConsignados = filter === "all" || filter === "consignacion";

  return (
    <div className={`grid gap-5 sm:gap-6 lg:gap-8 ${showVentas && showConsignados ? "lg:grid-cols-2" : "grid-cols-1"}`}>
      {/* SECCIÓN VENTAS */}
      {showVentas && (
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="p-2 rounded-lg bg-[color:var(--status-warning)]/10 shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-[color:var(--status-warning)]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">Top Vendidos</h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Por volumen de facturacion</p>
            </div>
          </div>

          <Card className="border border-border/50 shadow-[0_8px_26px_rgba(0,0,0,0.06)] dark:shadow-[0_14px_35px_rgba(0,0,0,0.26)] bg-gradient-to-b from-card/75 via-card/60 to-card/45 backdrop-blur-sm">
            <CardContent className="p-2 sm:p-3 space-y-1.5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3">
                    <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-full" />
                    <div className="space-y-2 flex-1 min-w-0"><Skeleton className="h-4 w-[60%]" /><Skeleton className="h-3 w-[40%]" /></div>
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))
              ) : (top?.topVendidos ?? []).length === 0 ? (
                <EmptyState message="Sin ventas en este período" />
              ) : (
                (top?.topVendidos ?? []).map((p: DashboardTopVendidos, index: number) => (
                  <ProductRow
                    key={p.productoId}
                    index={index}
                    rank={index + 1}
                    name={p.nombre}
                    detailMain={formatMoney(p.total)}
                    detailSub={`${formatNumber(p.units)} unidades`}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* SECCIÓN CONSIGNADOS */}
      {showConsignados && (
        <section className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="p-2 rounded-lg bg-[color:var(--theme-ocean-primary)]/10 shrink-0">
              <Package className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-[color:var(--theme-ocean-primary)]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold truncate">Mas Consignados</h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Flujo de salida de inventario</p>
            </div>
          </div>

          <Card className="border border-border/50 shadow-[0_8px_26px_rgba(0,0,0,0.06)] dark:shadow-[0_14px_35px_rgba(0,0,0,0.26)] bg-gradient-to-b from-card/75 via-card/60 to-card/45 backdrop-blur-sm">
            <CardContent className="p-2 sm:p-3 space-y-1.5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3">
                    <Skeleton className="h-9 w-9 sm:h-10 sm:w-10 rounded-full" />
                    <div className="space-y-2 flex-1 min-w-0"><Skeleton className="h-4 w-[60%]" /><Skeleton className="h-3 w-[40%]" /></div>
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))
              ) : (top?.topConsignados ?? []).length === 0 ? (
                <EmptyState message="Sin movimientos registrados" />
              ) : (
                (top?.topConsignados ?? []).map((p: DashboardTopConsignados, index: number) => (
                  <ProductRow
                    key={p.productoId}
                    index={index}
                    rank={index + 1}
                    name={p.nombre}
                    detailMain={formatNumber(p.unitsEntregadas)}
                    detailSub="Unidades entregadas"
                  />
                ))
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-12 px-4 text-center">
      <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
        <Package className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground font-medium max-w-[22ch]">{message}</p>
    </div>
  );
}
