"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, CheckCircle2, History, Zap } from "lucide-react";
import { formatNumber } from "@/lib/utils-format";
import Link from "next/link";
import { motion } from "framer-motion";

export function OperationsSection({ consig, loading }: { consig: any; loading: boolean }) {
  return (
    <div className="grid gap-8 xl:grid-cols-2">
      {/* SECCIÓN: PRIORIDAD */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Consignaciones Prioritarias</h3>
              <p className="text-[12px] text-muted-foreground">Pendientes que requieren acción inmediata</p>
            </div>
          </div>
        </div>

        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card/50 backdrop-blur-md overflow-hidden">
          <CardContent className="p-2 space-y-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2 flex-1"><Skeleton className="h-4 w-[40%]" /><Skeleton className="h-3 w-[20%]" /></div>
                </div>
              ))
            ) : (consig?.pendientesPrioridad ?? []).length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="text-emerald-500" />} message="Todo al día por aquí" />
            ) : (
              // SE AÑADIÓ .slice(0, 4) AQUÍ
              (consig?.pendientesPrioridad ?? []).slice(0, 4).map((c: any, index: number) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link 
                    href={`/consignaciones/${c.id}`}
                    className="group flex items-center justify-between p-4 rounded-xl hover:bg-red-500/[0.03] transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-[10px] font-bold text-red-600 border border-red-500/20">
                        #{c.id}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-sm font-semibold group-hover:text-red-600 transition-colors">
                          {c.cliente?.nombre ?? "Cliente Desconocido"}
                        </span>
                        <span className="text-[11px] text-muted-foreground/70 font-medium">
                          {new Date(c.fecha).toLocaleDateString("es-AR", { day: 'numeric', month: 'short' })} • {c.detalles?.length ?? 0} categorías
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs font-bold text-red-600 tabular-nums">
                          {formatNumber(c.unitsPendientes)}
                        </p>
                        <p className="text-[10px] uppercase tracking-tighter font-bold text-muted-foreground/50">Pendientes</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
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
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Últimas Liquidaciones</h3>
              <p className="text-[12px] text-muted-foreground">Flujo de cierre y cobranza reciente</p>
            </div>
          </div>
        </div>

        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card/50 backdrop-blur-md overflow-hidden">
          <CardContent className="p-2 space-y-1">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2 flex-1"><Skeleton className="h-4 w-[40%]" /><Skeleton className="h-3 w-[20%]" /></div>
                </div>
              ))
            ) : (consig?.ultimasLiquidaciones ?? []).length === 0 ? (
              <EmptyState icon={<History className="text-muted-foreground/50" />} message="No hay actividad reciente" />
            ) : (
              // SE CAMBIÓ .slice(0, 5) POR .slice(0, 4) AQUÍ
              (consig?.ultimasLiquidaciones ?? []).slice(0, 4).map((l: any, index: number) => {
                const vendidas = l.items?.reduce((a: number, b: any) => a + (b.unitsVendidas || 0), 0) || 0;
                return (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link 
                      href={`/consignaciones/${l.consignacionId}`}
                      className="group flex items-center justify-between p-4 rounded-xl hover:bg-emerald-500/[0.03] transition-all duration-300"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-[10px] font-bold text-emerald-600 border border-emerald-500/20">
                          L#{l.id}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-sm font-semibold group-hover:text-emerald-600 transition-colors">
                            {l.consignacion?.cliente?.nombre ?? "Cliente"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-emerald-600/80 font-bold">
                              +{formatNumber(vendidas)} vendidas
                            </span>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                            <span className="text-[10px] text-muted-foreground/60 font-medium">
                              {new Date(l.fecha).toLocaleDateString("es-AR")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
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

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-muted/20 rounded-2xl m-2">
      <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-xs text-muted-foreground font-medium">{message}</p>
    </div>
  );
}