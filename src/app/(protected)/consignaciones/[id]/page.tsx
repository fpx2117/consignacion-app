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
  History,
  BadgePercent, // Nuevo icono
  TrendingUp,   // Nuevo icono
} from "lucide-react";
import { toast } from "sonner";

import { apiService } from "@/lib/apiService";
import type { Consignacion, EstadoConsignacion } from "@/lib/types";
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

// Helper de moneda
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ConsignacionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [consignacion, setConsignacion] = React.useState<Consignacion | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getConsignacion(id);
      setConsignacion(res.data);
    } catch (e: any) {
      toast.error(e?.message ?? "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (id) load();
  }, [id, load]);

  const liquidaciones = React.useMemo(() => {
    const arr = (consignacion as any)?.liquidaciones;
    return Array.isArray(arr) ? arr : [];
  }, [consignacion]);

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

  const goLiquidacionesHistory = React.useCallback(() => {
    router.push(`/consignaciones/${id}/liquidaciones`);
  }, [router, id]);

  const handlePdfAction = async (mode: "view" | "whatsapp") => {
  if (!consignacion) return;

  let pdfUrl: string;
  try {
    pdfUrl = await apiService.getConsignacionPdfUrl(consignacion.id);
  } catch (e: any) {
    toast.error(e?.message ?? "No se pudo generar el remito");
    return;
  }

  if (mode === "view") {
    window.open(pdfUrl, "_blank");
    return;
  }

  const telefono = consignacion.cliente?.telefono;
  if (!telefono) {
    toast.error("El cliente no tiene teléfono registrado");
    return;
  }

  const phone = telefono.replace(/\D/g, "");
  const message =
    `*AllData POS - Remito*\n\n` +
    `Hola ${consignacion.cliente?.nombre}.\n` +
    `📄 Remito: ${pdfUrl}\n\n` +
    `⏳ Válido 7 días • Máx 3 vistas`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
};

  const detalles = consignacion?.detalles ?? [];
  const entregadas = detalles.reduce((a, d: any) => a + (d.unitsEntregadas ?? 0), 0);
  const vendidas = detalles.reduce((a, d: any) => a + (d.unitsVendidasAcum ?? 0), 0);
  const devueltas = detalles.reduce((a, d: any) => a + (d.unitsDevueltasAcum ?? 0), 0);
  const pendientes = Math.max(0, entregadas - vendidas - devueltas);

  const estado: EstadoConsignacion = consignacion?.estado ?? "ABIERTA";
  const puedeNuevaLiquidacion = !loading && estado === "ABIERTA";
  
  // OBTENER EL PORCENTAJE DEL OBJETO CONSIGNACIÓN
  const porcentajeAumento = consignacion?.porcentajeAumento || 0;

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
            className="border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400"
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
              <TrendingUp className="w-32 h-32 text-emerald-500" />
           </div>
        )}

        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-primary/10 p-4 rounded-2xl hidden sm:block font-bold">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">
                ID #{id}
              </Badge>
              <EstadoBadge estado={estado} />
              
              {/* 👈 BADGE DE AUMENTO */}
              {porcentajeAumento > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 gap-1 text-[10px] px-2">
                    <BadgePercent className="h-3 w-3" />
                    +{porcentajeAumento}% Aplicado
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">
              {loading ? <Skeleton className="h-8 w-48" /> : consignacion?.cliente?.nombre}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3.5 w-3.5" /> Iniciada el {consignacion?.fecha ? formatDate(consignacion.fecha) : "-"}
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

      {/* KPI Section */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <KpiCard icon={<Package className="text-blue-500" />} title="Entregadas" value={entregadas} loading={loading} />
        <KpiCard icon={<ShoppingCart className="text-emerald-500" />} title="Vendidas" value={vendidas} loading={loading} />
        <KpiCard icon={<Undo2 className="text-amber-500" />} title="Devueltas" value={devueltas} loading={loading} />
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
                detalles.map((d: any) => (
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
                <Download className="h-4 w-4 mr-3 text-blue-500" /> Descargar PDF
              </Button>
              <Button onClick={() => handlePdfAction("whatsapp")} className="w-full justify-start bg-emerald-600 hover:bg-emerald-700 text-white border-none h-12 shadow-emerald-900/10" disabled={loading}>
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
    <Badge variant="outline" className={cn("px-3 py-0.5 font-bold uppercase text-[9px] tracking-tighter rounded-full", isAbierta ? "border-emerald-500/50 text-emerald-600 bg-emerald-500/10" : "bg-slate-100 text-slate-500 border-slate-200 shadow-none")}>
      {isAbierta ? "● Abierta" : "Finalizada"}
    </Badge>
  );
}

function KpiCard({ title, value, loading, icon, emphasis }: any) {
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
function ProductRow({ d, porcentajeAumento }: { d: any; porcentajeAumento: number }) {
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
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
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
          <Progress value={percentVendido} className="h-2 w-28 bg-muted [&>div]:bg-emerald-500 shadow-sm" />
          
          <div className="mt-2 text-xs text-muted-foreground text-right">
             <span className="block font-bold text-foreground">Total Pendiente:</span>
             {formatMoney(pend * precioFinal)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/60">
        <StatItem label="Ventas" value={d.unitsVendidasAcum ?? 0} color="text-emerald-500" />
        <StatItem label="Devoluciones" value={d.unitsDevueltasAcum ?? 0} color="text-amber-500" border />
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