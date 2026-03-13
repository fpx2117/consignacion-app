/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
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
  Printer,
  MessageCircle,
  Ban,
  Flame,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // Estado del diálogo de anulación
  const [voidOpen, setVoidOpen] = React.useState(false);
  const [voidMotivo, setVoidMotivo] = React.useState("");
  const [brokenItems, setBrokenItems] = React.useState<number[]>([]);

  const toggleBrokenItem = (id: number) => {
    setBrokenItems(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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
    if (!venta || !voidMotivo) return;
    setIsDeleting(true);
    try {
      await apiService.anularVenta(venta.id as number, {
        motivo: voidMotivo,
        brokenItems,
      });
      toast.success("Venta anulada correctamente");
      setVoidOpen(false);
      // Recargar para mostrar estado anulado
      await load();
    } catch (error: any) {
      console.error("Error al anular:", error);
      toast.error("No se pudo anular la venta.");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Cálculos ---
  const detalles = venta?.detalles ?? [];
  const totalItems = detalles.reduce((acc, d) => acc + d.units, 0);
  const metodoPago = (venta as any)?.metodoPago || "Efectivo";
  const clienteNombre = venta?.cliente?.nombre || "Consumidor Final";
  const descuentoGlobal = Number((venta as any)?.descuentoGlobal || 0);
  const isAnulada = venta?.anulada === true;

  // Pérdida por rotura: suma de precioCosto * units de los ítems marcados como rotura
  const perdidaRotura = detalles
    .filter(d => (d as any).esRotura)
    .reduce((acc, d) => acc + Number((d.producto as any)?.precioCosto || 0) * d.units, 0);

  // Número visual de ticket (001)
  const ticketNumber = String(venta?.numeroVenta || id).padStart(3, '0');

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

        <div className="flex flex-wrap gap-2 items-center">

          {/* BOTÓN ANULAR (solo si no está anulada) */}
          {!isAnulada && (
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !venta}
              onClick={() => { setVoidMotivo(""); setBrokenItems([]); setVoidOpen(true); }}
              className="border-[color:var(--status-danger)] text-[color:var(--status-danger)] bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] hover:text-[color:var(--status-danger)] dark:border-[color:var(--status-danger)]/20 dark:bg-[color:var(--status-danger)]/10 dark:text-[color:var(--status-danger)]"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Anular Venta
            </Button>
          )}

          <div className="h-8 w-px bg-border mx-1 hidden sm:block" />

          {/* Botón Imprimir (deshabilitado si anulada) */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={loading || isAnulada}
            title={isAnulada ? "No se puede imprimir una venta anulada" : undefined}
          >
            <Printer className="h-4 w-4 mr-2 text-[color:var(--primary)]" />
            Imprimir Ticket
          </Button>
        </div>
      </div>

      {/* Diálogo de Anulación */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[color:var(--status-danger)]">
              <AlertTriangle className="h-5 w-5" /> Anular Venta #{ticketNumber}
            </DialogTitle>
            <DialogDescription>
              Seleccioná el motivo de anulación. El stock se devolverá automáticamente, excepto los ítems marcados como rotura.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Motivo */}
            <div className="space-y-2">
              <Label>Motivo de anulación</Label>
              <Select value={voidMotivo} onValueChange={setVoidMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un motivo…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Error de carga">Error de carga</SelectItem>
                  <SelectItem value="Devolución del cliente">Devolución del cliente</SelectItem>
                  <SelectItem value="Mal estado / Rotura">Mal estado / Rotura</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ítems rotos (siempre visible para flexibilidad) */}
            {detalles.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-[color:var(--status-danger)]" />
                  Marcar ítems dañados (no se devolverá su stock)
                </Label>
                <div className="border rounded-lg divide-y">
                  {detalles.map((d: any) => (
                    <div key={d.id} className="flex items-center gap-3 p-3">
                      <Checkbox
                        id={`broken-${d.id}`}
                        checked={brokenItems.includes(d.id)}
                        onCheckedChange={() => toggleBrokenItem(d.id)}
                      />
                      <label
                        htmlFor={`broken-${d.id}`}
                        className="flex-1 text-sm cursor-pointer"
                      >
                        <span className="font-medium">{d.producto?.nombre ?? `Producto #${d.productoId}`}</span>
                        <span className="text-muted-foreground ml-2">× {d.units}</span>
                      </label>
                      {brokenItems.includes(d.id) && (
                        <Badge variant="destructive" className="text-[10px]">ROTO</Badge>
                      )}
                    </div>
                  ))}
                </div>
                {brokenItems.length > 0 && (
                  <p className="text-xs text-[color:var(--status-danger)] font-medium">
                    Pérdida estimada por rotura:{" "}
                    {formatCurrency(
                      detalles
                        .filter(d => brokenItems.includes(d.id))
                        .reduce((acc, d) => acc + Number((d.producto as any)?.precioCosto || 0) * d.units, 0)
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setVoidOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button
              onClick={handleAnular}
              disabled={isDeleting || !voidMotivo}
              className="bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)]"
            >
              {isDeleting ? "Anulando…" : "Confirmar Anulación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header Profile (Card Principal) */}
      <div className={cn(
        "flex flex-col md:flex-row md:items-center justify-between gap-6 border rounded-2xl p-6 shadow-sm relative overflow-hidden",
        isAnulada ? "bg-[color:var(--status-danger)]/50 dark:bg-[color:var(--status-danger)]/20 border-[color:var(--status-danger)] dark:border-[color:var(--status-danger)]/40" : "bg-card"
      )}>
        {/* Decoración de fondo */}
        <div className={cn(
          "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10",
          isAnulada ? "bg-[color:var(--status-danger)]/10" : "bg-[color:var(--primary)]/5"
        )} />

        <div className="flex items-center gap-4 relative z-10">
          <div className={cn(
            "p-4 rounded-2xl hidden sm:block font-bold",
            isAnulada ? "bg-[color:var(--status-danger)]/10" : "bg-[color:var(--primary)]/10"
          )}>
            {isAnulada
              ? <Ban className="h-8 w-8 text-[color:var(--status-danger)]" />
              : <ShoppingCart className="h-8 w-8 text-[color:var(--primary)] dark:text-[color:var(--primary)]" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px] border-[color:var(--primary)]/30 text-[color:var(--primary)] dark:text-[color:var(--primary)]">
                TICKET #{ticketNumber}
              </Badge>
              {isAnulada ? (
                <Badge variant="destructive" className="px-3 py-0.5 font-bold uppercase text-[9px] tracking-tighter rounded-full">
                  ✕ ANULADA
                </Badge>
              ) : (
                <Badge variant="outline" className="px-3 py-0.5 font-bold uppercase text-[9px] tracking-tighter rounded-full border-[color:var(--status-success-strong)]/50 text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10">
                  ● Confirmada
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              {loading ? <Skeleton className="h-8 w-48" /> : clienteNombre}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3.5 w-3.5" /> Procesada el{" "}
              {venta?.fecha ? formatDate(venta.fecha) : "-"} hs
            </p>
            {isAnulada && venta?.motivoAnulacion && (
              <p className="text-xs text-[color:var(--status-danger)] font-medium mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Motivo: {venta.motivoAnulacion}
                {venta.fechaAnulacion && (
                  <span className="text-muted-foreground font-normal ml-1">
                    — {formatDate(venta.fechaAnulacion)}
                  </span>
                )}
              </p>
            )}
            {isAnulada && perdidaRotura > 0 && (
              <p className="text-xs text-[color:var(--status-danger)] font-bold mt-0.5 flex items-center gap-1">
                <Flame className="h-3 w-3" />
                Pérdida por rotura: {formatCurrency(perdidaRotura)}
              </p>
            )}
          </div>
        </div>

        {/* Total Gigante en el Header */}
        <div className="text-right relative z-10 flex flex-col items-end">
          {descuentoGlobal > 0 && !loading && (
            <Badge variant="outline" className="mb-2 bg-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]">
              Descuento General: -{formatCurrency(descuentoGlobal)}
            </Badge>
          )}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Abonado</p>

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
          icon={<Package className="text-[color:var(--primary)]" />}
          title="Total Productos"
          value={`${totalItems} u.`}
          loading={loading}
        />
        <KpiCard
          icon={<CreditCard className="text-[color:var(--status-success-strong)]" />}
          title="Método de Pago"
          value={metodoPago}
          loading={loading}
          textTransform="uppercase"
        />
        <KpiCard
          icon={<User className="text-[color:var(--status-warning)]" />}
          title="Tipo de Cliente"
          value={venta?.cliente ? "Registrado" : "Casual"}
          loading={loading}
        />
      </div >

      {/* Main Content Grid */}
      < div className="grid grid-cols-1 lg:grid-cols-12 gap-8" >

        {/* Columna Izquierda (8): Detalle de Venta */}
        < div className="lg:col-span-8 space-y-4" >
          <Card className="shadow-lg border-border bg-card/40 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-[color:var(--primary)]" /> Items Vendidos
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
        </div >

        {/* Columna Derecha (4): Acciones */}
        < div className="lg:col-span-4 space-y-6" >
          {isAnulada ? (
            <Card className="border-[color:var(--status-danger)] dark:border-[color:var(--status-danger)]/40 bg-[color:var(--status-danger)]/50 dark:bg-[color:var(--status-danger)]/20 shadow-none">
              <CardContent className="p-5 flex items-start gap-3">
                <Ban className="h-5 w-5 text-[color:var(--status-danger)] mt-0.5 shrink-0" />
                <div className="text-sm space-y-1">
                  <p className="font-bold text-[color:var(--status-danger)] dark:text-[color:var(--status-danger)]">Venta Anulada</p>
                  <p className="text-muted-foreground text-xs">
                    El stock fue devuelto al inventario para los ítems no dañados.
                    Los ítems marcados como rotura no recuperaron stock.
                  </p>
                  {perdidaRotura > 0 && (
                    <p className="text-xs text-[color:var(--status-danger)] font-semibold pt-1">
                      Pérdida registrada: {formatCurrency(perdidaRotura)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="shadow-xl border-[color:var(--primary)]/20 bg-[color:var(--primary)]/5 dark:bg-[color:var(--primary)]/10 overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-[color:var(--primary)]" /> Comprobante
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
                    <Download className="h-4 w-4 mr-3 text-[color:var(--primary)]" />
                    Descargar Ticket PDF
                  </Button>

                  <Button
                    onClick={() => {
                      const phone = venta?.cliente?.telefono || "";
                      const name = venta?.cliente?.nombre || "Cliente";
                      window.open(`/ticket-loading/${venta?.id}?mode=whatsapp&phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}`, '_blank');
                    }}
                    variant="outline"
                    className="w-full justify-start bg-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)] dark:bg-[color:var(--status-success-strong)]/10 dark:text-[color:var(--status-success-strong)] dark:border-[color:var(--status-success-strong)]/20 shadow-sm h-12"
                    disabled={loading}
                  >
                    <MessageCircle className="h-4 w-4 mr-3 text-[color:var(--status-success-strong)]" />
                    Compartir por WhatsApp
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-dashed bg-muted/30 shadow-none">
                <CardContent className="p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success-strong)] mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Stock Actualizado</p>
                    <p>Las unidades se descontaron automáticamente del inventario al momento de la venta.</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div >
      </div >
    </div >
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
  const precio = Number(d.precioUnitario || d.precioVenta || 0);
  const descuento = Number(d.descuento || 0);
  const subtotal = Number(d.subtotal);
  const nombreCategoria = d.producto?.categoria?.nombre || "Sin Categoría";
  const esRotura = d.esRotura === true;

  return (
    <div className={cn(
      "group rounded-xl border p-4 transition-all",
      esRotura
        ? "border-[color:var(--status-danger)] bg-[color:var(--status-danger)]/50 dark:bg-[color:var(--status-danger)]/20 dark:border-[color:var(--status-danger)]/40"
        : "border-border bg-background hover:bg-[color:var(--primary)]/50 hover:border-[color:var(--primary)] dark:hover:bg-[color:var(--primary)]/10 dark:hover:border-[color:var(--primary)]"
    )}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        {/* Info Producto */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn(
              "font-bold text-lg tracking-tight italic",
              esRotura ? "line-through text-[color:var(--status-danger)]" : "text-foreground group-hover:text-[color:var(--primary)] transition-colors"
            )}>
              {d.producto?.nombre ?? `Producto #${d.productoId}`}
            </p>
            {esRotura && (
              <Badge variant="destructive" className="text-[10px] font-bold shrink-0">
                <Flame className="h-3 w-3 mr-1" /> ROTO
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap mt-2">
            <Badge variant="secondary" className="text-[10px] font-mono bg-muted border-border text-foreground/80">
              {formatCurrency(precio)} ud.
            </Badge>

            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase font-bold tracking-tight",
                descuento > 0
                  ? "border-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)] dark:bg-[color:var(--status-success-strong)]/30 dark:border-[color:var(--status-success-strong)]/50 dark:text-[color:var(--status-success-strong)]"
                  : "border-muted-foreground/20 text-muted-foreground bg-muted/30"
              )}
            >
              {descuento > 0
                ? `Descuento ${nombreCategoria}: -${formatCurrency(descuento)}`
                : `Sin Descuento (${nombreCategoria})`}
            </Badge>
          </div>
        </div>

        {/* Info Cantidad y Total */}
        <div className="text-right flex items-center gap-6 sm:gap-10">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-muted-foreground uppercase mb-0.5">Cantidad</span>
            <span className={cn("text-xl font-black", esRotura ? "text-[color:var(--status-danger)]" : "text-foreground")}>{d.units}</span>
          </div>

          <div className="h-8 w-px bg-border" />

          <div className="flex flex-col items-end min-w-[80px]">
            <span className={cn("text-[9px] font-black uppercase mb-0.5", esRotura ? "text-[color:var(--status-danger)]" : "text-[color:var(--primary)]")}>
              {esRotura ? "Perdido" : "Subtotal"}
            </span>
            <span className={cn("text-xl font-black", esRotura ? "line-through text-[color:var(--status-danger)]" : "text-foreground")}>
              {formatCurrency(subtotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}