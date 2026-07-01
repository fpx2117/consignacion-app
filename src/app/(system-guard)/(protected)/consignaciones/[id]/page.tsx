//src/app/(protected)/consignaciones/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  RefreshCcw,
  Package,
  ShoppingCart,
  Undo2,
  Clock,
  FileText,
  AlertCircle,
  User,
  Share2,
  Download,
  MessageCircle,
  Pencil,
  BadgePercent,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

import { apiService } from "@/lib/apiService";
import { useTimezone } from "@/hooks/useTimezone";
import type { Consignacion, EstadoConsignacion } from "@/lib/types";
import { formatMoney } from "@/lib/date-format/utils-format";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export default function ConsignacionDetailPage() {
  const { formatWithOptions } = useTimezone();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [consignacion, setConsignacion] = React.useState<Consignacion | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getConsignacion(id);
      setConsignacion(res);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (id) load();
  }, [id, load]);

  const liquidaciones = React.useMemo(() => consignacion?.liquidaciones ?? [], [consignacion]);

  const tieneLiquidaciones = liquidaciones.length > 0;
  const lastLiquidacionId = tieneLiquidaciones ? Number(liquidaciones[0]?.id) : null;

  const goEditConsignacion = React.useCallback(() => {
    router.push(`/consignaciones/${id}/editar`);
  }, [router, id]);

  const goNewLiquidacion = React.useCallback(() => {
    router.push(`/consignaciones/${id}/liquidar`);
  }, [router, id]);

  const goEditLastLiquidacion = React.useCallback(() => {
    if (!lastLiquidacionId) return;
    router.push(`/liquidaciones/${lastLiquidacionId}/editar`);
  }, [router, lastLiquidacionId]);

  // goLiquidacionesHistory reservado para navegación futura al historial de liquidaciones

  const handlePdfAction = (mode: "view" | "whatsapp") => {
    if (!consignacion) return;

    let url = `/consignacion-loading/${consignacion.id}?mode=${mode}`;

    // Si es WhatsApp, necesitamos pasarle los datos del cliente a la página de carga
    // para que ella pueda armar el mensaje.
    if (mode === "whatsapp") {
      const telefono = consignacion.cliente?.telefono;
      if (!telefono) {
        toast.error("El cliente no tiene teléfono registrado");
        return;
      }
      const nombre = consignacion.cliente?.nombre || "";

      // Agregamos params a la URL
      url += `&phone=${encodeURIComponent(telefono)}&name=${encodeURIComponent(nombre)}`;
    }

    // Abrimos inmediatamente (sin bloqueos)
    window.open(url, '_blank');
  };

  const detalles = React.useMemo(() => consignacion?.detalles ?? [], [consignacion?.detalles]);
  const entregadas = detalles.reduce((a, d) => a + (Number(d.unitsEntregadas) ?? 0), 0);
  const vendidas = detalles.reduce((a, d) => a + (Number(d.unitsVendidasAcum) ?? 0), 0);
  const devueltas = detalles.reduce((a, d) => a + (Number(d.unitsDevueltasAcum) ?? 0), 0);
  const pendientes = Math.max(0, entregadas - vendidas - devueltas);

  const estado: EstadoConsignacion = consignacion?.estado ?? "ABIERTA";
  const puedeNuevaLiquidacion = !loading && estado === "ABIERTA";

  // OBTENER EL PORCENTAJE DEL OBJETO CONSIGNACIÓN
  const porcentajeAumento = consignacion?.porcentajeAumento || 0;

  // PRECIO FINAL DE LA CONSIGNACIÓN
  const precioFinalConsignacion = React.useMemo(() => {
    if (!consignacion) return 0;

    if (tieneLiquidaciones) {
      // Ya liquidada: sumar totales de las ventas generadas por cada liquidación
      return liquidaciones.reduce((total, liq) => {
        if (liq.venta?.total) return total + Number(liq.venta.total);
        // Fallback: calcular desde los items de la liquidación
        const itemsTotal = (liq.items ?? []).reduce((sum, item) => {
          return sum + (Number(item.unitsVendidas ?? 0) * Number(item.precioUnitario ?? 0));
        }, 0);
        return total + itemsTotal;
      }, 0);
    }

    // No liquidada: total de productos consignados (entregadas × precio unitario)
    return detalles.reduce((total, d) => {
      let precio = Number(d.precioUnitario);
      if (!precio || precio === 0) {
        const precioBase = Number(d.producto?.precioVenta || 0);
        precio = precioBase * (1 + porcentajeAumento / 100);
      }
      return total + (Number(d.unitsEntregadas ?? 0) * precio) - Number(d.descuento || 0);
    }, 0);
  }, [consignacion, tieneLiquidaciones, liquidaciones, detalles, porcentajeAumento]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10 px-4 sm:px-0 animate-in fade-in duration-500">

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/consignaciones")} className="gap-2 text-muted-foreground hover:text-foreground w-fit">
          <ArrowLeft className="h-4 w-4" /> Volver al listado
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !consignacion || (tieneLiquidaciones && !lastLiquidacionId)}
            onClick={() => {
              if (!consignacion) return;
              if (tieneLiquidaciones) return goEditLastLiquidacion();
              return goEditConsignacion();
            }}
            className="border-[color:var(--status-warning)] text-[color:var(--status-warning)] bg-[color:var(--status-warning)] hover:bg-[color:var(--status-warning)] dark:border-[color:var(--status-warning)]/20 dark:bg-[color:var(--status-warning)]/10 dark:text-[color:var(--status-warning)]"
          >
            <Pencil className="h-4 w-4 mr-2" />
            {tieneLiquidaciones ? "Corregir Liquidación" : "Editar Consignación"}
          </Button>



          <div className="h-8 w-px bg-border mx-1 hidden sm:block" />



          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="border-border">
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Header Profile */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border rounded-2xl p-6 shadow-sm relative overflow-hidden">

        {/* FONDO DECORATIVO SI HAY AUMENTO */}
        {porcentajeAumento > 0 && (
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <TrendingUp className="w-32 h-32 text-[color:var(--status-success-strong)]" />
          </div>
        )}

        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-primary/10 p-4 rounded-2xl hidden sm:block font-bold">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <EstadoBadge estado={estado} />

              {/* 👈 BADGE DE AUMENTO */}
              {porcentajeAumento > 0 && (
                <Badge className="bg-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)] gap-1 text-[10px] px-2">
                  <BadgePercent className="h-3 w-3" />
                  +{porcentajeAumento}% Aplicado
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {loading ? <Skeleton className="h-8 w-48" /> : consignacion?.cliente?.nombre}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3.5 w-3.5" /> Iniciada el {consignacion?.fecha ? formatWithOptions(consignacion.fecha, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }) : "-"}
            </p>
          </div>
        </div>

        <Button
          size="lg"
          className="h-14 px-8 text-lg font-bold shadow-xl shadow-primary/20 group relative z-10"
          disabled={!puedeNuevaLiquidacion}
          onClick={goNewLiquidacion}
        >
          Nueva Liquidación <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>

      {/* Precio Final - Card destacada */}
      <Card className={cn(
        "shadow-lg border-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500",
        tieneLiquidaciones
          ? "bg-[color:var(--status-success-strong)]/50 border-[color:var(--status-success-strong)] dark:bg-[color:var(--status-success-strong)]/20 dark:border-[color:var(--status-success-strong)]/20"
          : "bg-card"
      )}>
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5 px-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
              tieneLiquidaciones
                ? "bg-[color:var(--status-success-strong)] dark:bg-[color:var(--status-success-strong)]/20"
                : "bg-primary/10"
            )}>
              <DollarSign className={cn(
                "h-6 w-6",
                tieneLiquidaciones ? "text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)]" : "text-primary"
              )} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {tieneLiquidaciones ? "Total Liquidado" : "Valor Total Consignado"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tieneLiquidaciones
                  ? `Suma de ${liquidaciones.length} liquidación${liquidaciones.length > 1 ? "es" : ""} realizada${liquidaciones.length > 1 ? "s" : ""}`
                  : "Precio total de los productos entregados"
                }
              </p>
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-10 w-40" />
          ) : (
            <p className={cn(
              "text-4xl font-black tracking-tight",
              tieneLiquidaciones
                ? "text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)]"
                : "text-foreground"
            )}>
              {formatMoney(precioFinalConsignacion)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* KPI Section */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <KpiCard icon={<Package className="text-[color:var(--theme-ocean-primary)]" />} title="Entregadas" value={entregadas} loading={loading} />
        <KpiCard icon={<ShoppingCart className="text-[color:var(--status-success-strong)]" />} title="Vendidas" value={vendidas} loading={loading} />
        <KpiCard icon={<Undo2 className="text-[color:var(--status-warning)]" />} title="Devueltas" value={devueltas} loading={loading} />
        <KpiCard
          icon={<AlertCircle className={pendientes > 0 ? "text-destructive" : "text-muted-foreground"} />}
          title="Pendientes"
          value={pendientes}
          loading={loading}
          emphasis={pendientes > 0}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Columna Izquierda (8): Inventario */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="shadow-lg border-border bg-card/40 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-primary" /> Detalle de Stock
              </CardTitle>
              <CardDescription className="text-muted-foreground">Estado actual por producto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                </div>
              ) : (
                detalles.map((d) => (
                  <ProductRow key={d.id} d={d} porcentajeAumento={porcentajeAumento} />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha (4): Documentos y Acciones */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-xl border-primary/20 bg-primary/5 dark:bg-primary/10 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Share2 className="h-5 w-5 text-primary" /> Compartir
              </CardTitle>
              <CardDescription>Envía el remito oficial al cliente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => handlePdfAction("view")} variant="outline" className="w-full justify-start bg-background hover:bg-muted shadow-sm h-12" disabled={loading}>
                <Download className="h-4 w-4 mr-3 text-[color:var(--theme-ocean-primary)]" /> Descargar PDF
              </Button>
              <Button onClick={() => handlePdfAction("whatsapp")} className="w-full justify-start bg-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)] text-[color:var(--ui-fx-white)] border-none h-12 shadow-emerald-900/10" disabled={loading}>
                <MessageCircle className="h-4 w-4 mr-3" /> Enviar por WhatsApp
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed bg-muted/30 shadow-none">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Acceso Seguro</p>
                <p>El enlace de WhatsApp es seguro y no requiere login.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Subcomponentes ---

function EstadoBadge({ estado }: { estado: EstadoConsignacion }) {
  const isAbierta = estado === "ABIERTA";
  return (
    <Badge variant="outline" className={cn("px-3 py-0.5 font-bold uppercase text-[9px] tracking-tighter rounded-full", isAbierta ? "border-[color:var(--status-success-strong)]/50 text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10" : "bg-muted/55 text-muted-foreground border-border shadow-none")}>
      {isAbierta ? "● Abierta" : "Finalizada"}
    </Badge>
  );
}

interface KpiCardProps {
  title: string;
  value: string | number;
  loading: boolean;
  icon: React.ReactNode;
  emphasis?: boolean;
}
function KpiCard({ title, value, loading, icon, emphasis }: KpiCardProps) {
  return (
    <Card className={cn("shadow-md border-border bg-card transition-all hover:translate-y-[-2px]", emphasis && "border-destructive/30 bg-destructive/5")}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
        <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em]">{title}</CardTitle>
        <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center shadow-inner">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <div className={cn("text-3xl font-black tracking-tighter text-foreground", emphasis && "text-destructive")}>{value}</div>}
      </CardContent>
    </Card>
  );
}

// --- PRODUCT ROW CON PRECIOS ---
function ProductRow({ d, porcentajeAumento }: { d: import("@/lib/types").ConsignacionDetalle; porcentajeAumento: number }) {
  const pend = Math.max(0, (d.unitsEntregadas ?? 0) - (d.unitsVendidasAcum ?? 0) - (d.unitsDevueltasAcum ?? 0));
  const percentVendido = (d.unitsEntregadas ?? 0) > 0 ? ((d.unitsVendidasAcum ?? 0) / d.unitsEntregadas) * 100 : 0;

  // Lógica de precios
  // 1. Intentamos usar el precio guardado en el detalle (si tu backend ya lo soporta)
  // 2. Si es 0 o null, calculamos al vuelo usando el producto actual y el porcentaje
  let precioFinal = Number(d.precioUnitario);

  if (!precioFinal || precioFinal === 0) {
    const precioBase = Number(d.producto?.precioVenta || 0);
    precioFinal = precioBase * (1 + porcentajeAumento / 100);
  }

  return (
    <div className="group rounded-xl border border-border p-4 bg-background transition-all hover:bg-muted/10 hover:border-primary/30">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">

        {/* INFO PRODUCTO */}
        <div className="space-y-1">
          <p className="font-bold text-foreground text-lg tracking-tight italic group-hover:text-primary transition-colors">
            {d.producto?.nombre ?? `Producto #${d.productoId}`}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="text-[10px] font-mono bg-muted border-border text-foreground/80">
              {d.unitsEntregadas} entregadas
            </Badge>
            {Number(d.descuento) > 0 && (
              <Badge variant="outline" className="text-[10px] border-[color:var(--primary)] text-[color:var(--primary)] bg-[color:var(--primary)] dark:bg-[color:var(--primary)]/30">
                - {formatMoney(Number(d.descuento))} Descuento
              </Badge>
            )}
            {pend > 0 && (
              <span className="text-[10px] font-black text-destructive uppercase tracking-tighter border-b-2 border-destructive/20 pb-0.5">
                ⚠️ {pend} pendientes
              </span>
            )}
          </div>

          {/* PRECIOS */}
          <div className="pt-2 flex flex-col gap-0.5">
            <div className="text-[10px] text-muted-foreground">Precio Unitario</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)]">
                {formatMoney(precioFinal)}
              </span>
              {porcentajeAumento > 0 && (
                <span className="text-xs text-muted-foreground line-through decoration-destructive/50">
                  {d.producto?.precioVenta ? formatMoney(d.producto.precioVenta) : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="text-right flex flex-col items-end min-w-[120px]">
          <span className="text-[10px] font-black text-muted-foreground uppercase mb-1">
            {Math.round(percentVendido)}% Liquidado
          </span>
          <Progress value={percentVendido} className="h-2 w-28 bg-muted [&>div]:bg-[color:var(--status-success-strong)] shadow-sm" />

          <div className="mt-2 text-xs text-muted-foreground text-right">
            <span className="block font-bold text-foreground">Total Pendiente:</span>
            {formatMoney(pend * precioFinal)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/60">
        <StatItem label="Ventas" value={d.unitsVendidasAcum ?? 0} color="text-[color:var(--status-success-strong)]" />
        <StatItem label="Devoluciones" value={d.unitsDevueltasAcum ?? 0} color="text-[color:var(--status-warning)]" border />
        <StatItem label="Pendiente" value={pend} color={pend > 0 ? "text-destructive" : "text-muted-foreground"} border />
      </div>
    </div>
  );
}

function StatItem({ label, value, color, border }: { label: string; value: number; color: string; border?: boolean }) {
  return (
    <div className={cn("text-center", border && "border-l border-border/40")}>
      <p className="text-[9px] uppercase text-muted-foreground font-black tracking-widest leading-none mb-1.5">{label}</p>
      <p className={cn("text-sm font-black", color)}>{value}</p>
    </div>
  );
}
