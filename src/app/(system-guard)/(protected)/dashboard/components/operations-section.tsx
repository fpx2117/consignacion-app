"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, CheckCircle2, History, Zap } from "lucide-react";
import { formatNumber } from "@/lib/date-format/utils-format";
import Link from "next/link";
import { motion } from "motion/react";
import type {
  DashboardConsignacionesResponse,
  DashboardLiquidacionItem,
} from "@/lib/types";
import { useTimezone } from "@/hooks/useTimezone";

type OperationsSectionProps = {
  consig?: DashboardConsignacionesResponse | null;
  loading: boolean;
};

export function OperationsSection({ consig, loading }: OperationsSectionProps) {
  const { tz } = useTimezone();
  return (
    <div className="grid gap-8 xl:grid-cols-2">
      {/* SECCIÓN: PRIORIDAD */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)]">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Consignaciones Prioritarias
              </h3>
              <p className="text-[12px] text-muted-foreground">
                Pendientes que requieren acción inmediata
              </p>
            </div>
          </div>
        </div>

        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card/50 backdrop-blur-md overflow-hidden">
          <CardContent className="p-2 space-y-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[40%]" />
                    <Skeleton className="h-3 w-[20%]" />
                  </div>
                </div>
              ))
            ) : (consig?.pendientesPrioridad ?? []).length === 0 ? (
              <EmptyState
                icon={
                  <CheckCircle2 className="text-[color:var(--status-success-strong)]" />
                }
                message="Todo al día por aquí"
              />
            ) : (
              (consig?.pendientesPrioridad ?? [])
                .slice(0, 4)
                .map((c, index) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={`/consignaciones/${c.id}`}
                      className="group flex items-center justify-between p-4 rounded-2xl bg-card/40 border border-border/50 hover:bg-card/60 shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-md"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--status-danger)]/10 to-[color:var(--status-danger)]/5 text-[color:var(--status-danger)] ring-1 ring-[color:var(--status-danger)]/20 shadow-inner">
                          <span className="text-xs font-black">#{c.id}</span>
                          {index === 0 && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--status-danger)] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-[color:var(--status-danger)]"></span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 gap-0.5">
                          <span className="truncate text-sm font-bold text-foreground/90 group-hover:text-[color:var(--status-danger)] transition-colors">
                            {c.cliente?.nombre ?? "Cliente Desconocido"}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/70">
                            <span className="bg-[color:var(--status-danger)] dark:bg-[color:var(--status-danger)]/20 text-[color:var(--status-danger)] dark:text-[color:var(--status-danger)] px-1.5 py-0.5 rounded-md leading-none">
                              {new Date(c.fecha).toLocaleDateString("es-AR", {
                                day: "numeric",
                                month: "short",
                                timeZone: tz,
                              })}
                            </span>
                            <span>•</span>
                            <span>{c.detalles?.length ?? 0} categorías</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-black text-[color:var(--status-danger)] tabular-nums">
                            {formatNumber(c.unitsPendientes)}
                          </p>
                          <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/50">
                            Pendientes
                          </p>
                        </div>
                        <div className="h-8 w-8 rounded-full flex items-center justify-center bg-transparent group-hover:bg-[color:var(--status-danger)]/10 transition-colors">
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-[color:var(--status-danger)] transition-colors" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN: ÚLTIMAS LIQUIDACIONES */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Últimas Liquidaciones
              </h3>
              <p className="text-[12px] text-muted-foreground">
                Flujo de cierre y cobranza reciente
              </p>
            </div>
          </div>
        </div>

        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card/50 backdrop-blur-md overflow-hidden">
          <CardContent className="p-2 space-y-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[40%]" />
                    <Skeleton className="h-3 w-[20%]" />
                  </div>
                </div>
              ))
            ) : (consig?.ultimasLiquidaciones ?? []).length === 0 ? (
              <EmptyState
                icon={<History className="text-muted-foreground/50" />}
                message="No hay actividad reciente"
              />
            ) : (
              (consig?.ultimasLiquidaciones ?? [])
                .slice(0, 4)
                .map((l, index) => {
                  const vendidas =
                    l.items?.reduce(
                      (acc, item: DashboardLiquidacionItem) =>
                        acc + (item.unitsVendidas || 0),
                      0,
                    ) || 0;
                  return (
                    <motion.div
                      key={l.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={`/consignaciones/${l.consignacionId}`}
                        className="group flex items-center justify-between p-4 rounded-2xl bg-card/40 border border-border/50 hover:bg-card/60 shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-md"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--status-success-strong)]/10 to-[color:var(--status-success-strong)]/5 text-[color:var(--status-success-strong)] ring-1 ring-[color:var(--status-success-strong)]/20 shadow-inner">
                            <span className="text-xs font-black">L#{l.id}</span>
                          </div>
                          <div className="flex flex-col min-w-0 gap-0.5">
                            <span className="truncate text-sm font-bold text-foreground/90 group-hover:text-[color:var(--status-success-strong)] transition-colors">
                              {l.consignacion?.cliente?.nombre ?? "Cliente"}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground/70">
                              <span className="bg-[color:var(--status-success-strong)] dark:bg-[color:var(--status-success-strong)]/20 text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)] px-1.5 py-0.5 rounded-md leading-none">
                                {new Date(l.fecha).toLocaleDateString("es-AR", {
                                  timeZone: tz,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-sm font-black text-[color:var(--status-success-strong)] tabular-nums">
                              +{formatNumber(vendidas)}
                            </span>
                            <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/50">
                              Vendidas
                            </p>
                          </div>
                          <div className="h-8 w-8 rounded-full flex items-center justify-center bg-transparent group-hover:bg-[color:var(--status-success-strong)]/10 transition-colors">
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-[color:var(--status-success-strong)] transition-colors" />
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-muted/20 rounded-2xl m-2">
      <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-xs text-muted-foreground font-medium">{message}</p>
    </div>
  );
}
