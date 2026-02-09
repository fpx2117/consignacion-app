"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatMoney } from "@/lib/utils-format";
import { motion } from "framer-motion"; 
import { TrendingUp, Package, ChevronRight } from "lucide-react";

export function TopProductsSection({ top, loading }: { top: any; loading: boolean }) {
  
  // Se cambió Link por div y se eliminaron las clases de hover relacionadas con interactividad
  const ProductRow = ({ rank, name, detailMain, detailSub, index }: any) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div 
        className="group flex items-center gap-4 p-3 rounded-xl bg-transparent transition-all duration-300 ease-out"
      >
        {/* Ranking */}
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background text-sm font-medium text-muted-foreground transition-colors">
          {rank}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            {name}
          </p>
          <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground/70 mt-0.5">
            {detailSub}
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-right">
          <div className="flex flex-col items-end">
            <p className="text-sm font-bold tabular-nums tracking-tight">{detailMain}</p>
          </div>
          {/* Opcional: Se eliminó el icono ChevronRight para evitar confusión de que es un link */}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      {/* SECCIÓN VENTAS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Top Vendidos</h3>
            <p className="text-[12px] text-muted-foreground">Por volumen de facturación</p>
          </div>
        </div>

        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card/50 backdrop-blur-sm">
          <CardContent className="p-2 space-y-1">
            {loading ? (
               Array.from({ length: 5 }).map((_, i) => (
                 <div key={i} className="flex items-center gap-4 p-3">
                   <Skeleton className="h-10 w-10 rounded-full" />
                   <div className="space-y-2 flex-1"><Skeleton className="h-4 w-[60%]" /><Skeleton className="h-3 w-[40%]" /></div>
                   <Skeleton className="h-4 w-12" />
                 </div>
               ))
            ) : (top?.topVendidos ?? []).length === 0 ? (
               <EmptyState message="Sin ventas en este período" />
            ) : (
              (top?.topVendidos ?? []).map((p: any, index: number) => (
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

      {/* SECCIÓN CONSIGNADOS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Más Consignados</h3>
            <p className="text-[12px] text-muted-foreground">Flujo de salida de inventario</p>
          </div>
        </div>

        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-card/50 backdrop-blur-sm">
          <CardContent className="p-2 space-y-1">
            {loading ? (
               Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1"><Skeleton className="h-4 w-[60%]" /><Skeleton className="h-3 w-[40%]" /></div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))
            ) : (top?.topConsignados ?? []).length === 0 ? (
               <EmptyState message="Sin movimientos registrados" />
            ) : (
              (top?.topConsignados ?? []).map((p: any, index: number) => (
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
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="h-12 w-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
        <Package className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  );
}