"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  ShoppingCart,
  Clock,
  FileText,
  Share2,
  Download,
  Trash2,
  CreditCard,
  CheckCircle2,
  User,
  AlertTriangle,
  Printer
} from "lucide-react";
import { toast } from "sonner";

import { apiService } from "@/lib/apiService";
import type { Venta } from "@/lib/types";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- Helpers ---
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function VentaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  // Estados
  const [venta, setVenta] = React.useState<Venta | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getVenta(id);
      setVenta(res);
    } catch (e: any) {
      toast.error(e?.message ?? "Error cargando datos de la venta");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (id) load();
  }, [id, load]);

  // --- Acción solo para TICKET (Ver/Descargar) ---
  const handleDownloadPdf = () => {
    if (!venta) return;

    // 1. Redirigimos a nuestra página de carga intermedia
    // Al ser inmediato, el navegador NO lo bloquea.
    const url = `/ticket-loading/${venta.id}`;
    window.open(url, '_blank');
  };

  // --- Anular Venta ---
  const handleAnular = async () => {
    if (!venta) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/ventas/${venta.id}`, { method: "DELETE" });
      toast.success("Venta anulada y stock restaurado");
      router.push("/ventas/nueva");
    } catch (error) {
      console.error("Error al anular:", error);
      toast.error("No se pudo anular la venta.");
      setIsDeleting(false);
    }
  };

  // --- Cálculos ---
  const detalles = venta?.detalles ?? [];
  const totalItems = detalles.reduce((acc, d) => acc + d.units, 0);
  const metodoPago = (venta as any)?.metodoPago || "Efectivo";
  const clienteNombre = venta?.cliente?.nombre || "Consumidor Final";

  // Número visual de ticket (001)
  const ticketNumber = String(id).padStart(3, '0');

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10 px-4 sm:px-0 animate-in fade-in duration-500">

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2 text-muted-foreground hover:text-foreground w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>

        <div className="flex flex-wrap gap-2">

          {/* BOTÓN ANULAR (PELIGRO) */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || !venta}
                className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100 hover:text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Anular Venta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" /> ¿Estás seguro?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción es irreversible. Se eliminará el registro de venta y <strong>se devolverá el stock</strong> de los productos al inventario.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleAnular} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                  {isDeleting ? "Anulando..." : "Sí, Anular Venta"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="h-8 w-px bg-border mx-1 hidden sm:block" />

          {/* Botón Imprimir (Acción rápida Header) */}
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={loading}>
            <Printer className="h-4 w-4 mr-2 text-indigo-500" />
            Imprimir Ticket
          </Button>

        </div>
      </div>

      {/* Header Profile (Card Principal) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border rounded-2xl p-6 shadow-sm relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-10 -mt-10" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-indigo-500/10 p-4 rounded-2xl hidden sm:block font-bold">
            <ShoppingCart className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-mono text-[10px] border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                TICKET #{ticketNumber}
              </Badge>
              <Badge variant="outline" className="px-3 py-0.5 font-bold uppercase text-[9px] tracking-tighter rounded-full border-emerald-500/50 text-emerald-600 bg-emerald-500/10">
                ● Confirmada
              </Badge>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              {loading ? <Skeleton className="h-8 w-48" /> : clienteNombre}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3.5 w-3.5" /> Procesada el{" "}
              {venta?.fecha ? formatDate(venta.fecha) : "-"} hs
            </p>
          </div>
        </div>

        {/* Total Gigante en el Header */}
        <div className="text-right relative z-10">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Abonado</p>

          {/* ✅ CAMBIO: Usamos <div> aquí porque adentro puede haber un Skeleton (que es otro div) */}
          <div className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
            {loading ? (
              <Skeleton className="h-12 w-32 ml-auto" />
            ) : (
              formatCurrency(Number(venta?.total || 0))
            )}
          </div>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <KpiCard
          icon={<Package className="text-indigo-500" />}
          title="Total Productos"
          value={`${totalItems} u.`}
          loading={loading}
        />
        <KpiCard
          icon={<CreditCard className="text-emerald-500" />}
          title="Método de Pago"
          value={metodoPago}
          loading={loading}
          textTransform="uppercase"
        />
        <KpiCard
          icon={<User className="text-amber-500" />}
          title="Tipo de Cliente"
          value={venta?.cliente ? "Registrado" : "Casual"}
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Columna Izquierda (8): Detalle de Venta */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="shadow-lg border-border bg-card/40 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-indigo-500" /> Items Vendidos
              </CardTitle>
              <CardDescription className="text-muted-foreground">Productos incluidos en el ticket.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                detalles.map((d: any) => <ProductRowVenta key={d.id} d={d} />)
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna Derecha (4): Acciones */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-xl border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Share2 className="h-5 w-5 text-indigo-500" /> Comprobante
              </CardTitle>
              <CardDescription>Opciones del documento digital.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleDownloadPdf}
                variant="outline"
                className="w-full justify-start bg-background hover:bg-muted shadow-sm h-12"
                disabled={loading}
              >
                <Download className="h-4 w-4 mr-3 text-indigo-500" />
                Descargar Ticket PDF
              </Button>

              {/* [NOTA]: Se eliminó el botón de WhatsApp porque esta vista corresponde a TICKET POS.
                 Solo debe mostrarse en la vista de REMITO / CONSIGNACION.
              */}

            </CardContent>
          </Card>

          <Card className="border-dashed bg-muted/30 shadow-none">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Stock Actualizado</p>
                <p>Las unidades se descontaron automáticamente del inventario al momento de la venta.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Subcomponentes ---

function KpiCard({ title, value, loading, icon, textTransform }: any) {
  return (
    <Card className="shadow-md border-border bg-card transition-all hover:translate-y-[-2px]">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 text-muted-foreground">
        <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em]">{title}</CardTitle>
        <div className="h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center shadow-inner">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className={cn("text-2xl font-black tracking-tighter text-foreground", textTransform)}>
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductRowVenta({ d }: { d: any }) {
  const precio = Number(d.precioUnitario);
  const subtotal = precio * d.units;

  return (
    <div className="group rounded-xl border border-border p-4 bg-background transition-all hover:bg-indigo-50/50 hover:border-indigo-200 dark:hover:bg-indigo-900/10 dark:hover:border-indigo-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Info Producto */}
        <div className="space-y-1">
          <p className="font-bold text-foreground text-lg tracking-tight italic group-hover:text-indigo-600 transition-colors">
            {d.producto?.nombre ?? `Producto #${d.productoId}`}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="text-[10px] font-mono bg-muted border-border text-foreground/80">
              {formatCurrency(precio)} unitario
            </Badge>
          </div>
        </div>

        {/* Info Cantidad y Total */}
        <div className="text-right flex items-center gap-6 sm:gap-10">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-muted-foreground uppercase mb-0.5">Cantidad</span>
            <span className="text-xl font-black text-foreground">{d.units}</span>
          </div>

          <div className="h-8 w-px bg-border" />

          <div className="flex flex-col items-end min-w-[80px]">
            <span className="text-[9px] font-black text-indigo-500 uppercase mb-0.5">Subtotal</span>
            <span className="text-xl font-black text-foreground">{formatCurrency(subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}