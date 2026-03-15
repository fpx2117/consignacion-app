//src/app/(protected)/consignaciones/[id]/liquidar/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, ArrowLeft, Receipt, Undo2, ShoppingCart,
  TrendingUp, Package, User, ChevronRight, BadgePercent, CheckCircle2
} from "lucide-react";


import { apiService } from "@/lib/apiService";
import type { Consignacion, CreateLiquidacionInput } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// IMPORTAMOS EL DIÁLOGO DE ÉXITO (Asegúrate de tener este componente o quítalo si no lo usas)
import { SuccessDialog } from "@/components/success-dialog";

import type { Subcategoria } from "@/lib/types";

type Row = {
  consignacionDetalleId: number;
  productoNombre: string;
  maxPendiente: number;
  precioBase: number;
  precioFinal: number; // Precio con aumento aplicado
  unitsVendidas: number;
  unitsDevueltas: number;
  descuento: number;
  subcategoria?: Subcategoria | null;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
};

export default function LiquidarConsignacionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const consignacionId = Number(params.id);

  const [consignacion, setConsignacion] = React.useState<Consignacion | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);


  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await apiService.getConsignacion(consignacionId);
      setConsignacion(c);

      const porcentaje = c.porcentajeAumento || 0;

      const mapped: Row[] = (c.detalles ?? []).map((d) => {
        const pend = Math.max(0, d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum);
        const precioBase = Number(d.producto?.precioVenta ?? 0);

        let precioFinal = Number(d.precioVentaAplicado);
        if (!precioFinal || precioFinal === 0) {
          precioFinal = precioBase * (1 + porcentaje / 100);
        }

        return {
          consignacionDetalleId: d.id,
          productoNombre: d.producto?.nombre ?? `Producto #${d.productoId}`,
          precioBase,
          precioFinal,
          maxPendiente: pend,
          unitsVendidas: 0,
          unitsDevueltas: pend,
          descuento: 0,
          subcategoria: (d.producto as (typeof d.producto & { subcategoria?: Subcategoria | null }) | undefined)?.subcategoria ?? null
        };
      });

      setRows(mapped);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando consignación");
    } finally {
      setLoading(false);
    }
  }, [consignacionId]);

  React.useEffect(() => {
    if (consignacionId) load();
  }, [consignacionId, load]);

  const updateRow = (id: number, inputValue: string) => {
    let val = inputValue === "" ? 0 : Number(inputValue);

    setRows((prev) => prev.map((r) => {
      if (r.consignacionDetalleId !== id) return r;

      if (val > r.maxPendiente) val = r.maxPendiente;
      if (val < 0) val = 0;

      const vendidas = val;
      const devueltas = r.maxPendiente - val;

      let discount = 0;
      const subDescuentos = r.subcategoria?.descuentos;
      if (subDescuentos && Array.isArray(subDescuentos)) {
        const sorted = [...subDescuentos].sort((a, b) => b.cantidadMin - a.cantidadMin);
        const best = sorted.find((d) => vendidas >= d.cantidadMin);
        if (best) {
          discount = (r.precioFinal * vendidas) * (best.porcentaje / 100);
        }
      }

      return {
        ...r,
        unitsVendidas: vendidas,
        unitsDevueltas: devueltas,
        descuento: discount
      };
    }));
  };

  // --- CÁLCULOS TOTALES ---
  const actionableRows = rows.filter(r => r.maxPendiente > 0);
  const totalVendidoUnits = rows.reduce((acc, r) => acc + (r.unitsVendidas || 0), 0);
  const totalDevueltoUnits = rows.reduce((acc, r) => acc + (r.unitsDevueltas || 0), 0);
  const totalDescuento = rows.reduce((acc, r) => acc + (r.descuento || 0), 0);
  const totalDinero = rows.reduce((acc, r) => acc + ((r.unitsVendidas || 0) * r.precioFinal) - (r.descuento || 0), 0);

  // --- VALIDACIÓN AL GUARDAR ---
  const validate = () => {
    if (actionableRows.length === 0) return "No hay pendientes para liquidar.";

    // Verificamos coherencia (aunque la UI ya lo fuerza)
    for (const r of actionableRows) {
      if (r.unitsVendidas + r.unitsDevueltas !== r.maxPendiente) {
        return `Error en ${r.productoNombre}: La suma de vendidas y devueltas debe ser igual al stock (${r.maxPendiente})`;
      }
    }

    // Al menos un movimiento debe haber (opcional, depende de tu negocio)
    // if (totalVendidoUnits + totalDevueltoUnits === 0) return "No hay movimientos registrados.";

    return null;
  };

  const submit = async () => {
    setError(null);
    const msg = validate();
    if (msg) return setError(msg);

    setSaving(true);
    try {
      const payload: CreateLiquidacionInput = {
        items: rows
          .filter((r) => r.maxPendiente > 0) // Enviamos todos los que tenían pendiente
          .map((r) => ({
            consignacionDetalleId: r.consignacionDetalleId,
            unitsVendidas: Number(r.unitsVendidas),
            unitsDevueltas: Number(r.unitsDevueltas),
            descuento: Number(r.descuento || 0),
          })),
      };

      await apiService.createLiquidacion(consignacionId, payload);
      setShowSuccessDialog(true);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando liquidación");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!consignacionId || Number.isNaN(consignacionId)) return;

    // 1. Abrimos la página de carga INMEDIATAMENTE.
    // Al no haber 'await', el navegador detecta que es una acción directa del usuario y la permite.
    const loadingUrl = `/consignacion-loading/${consignacionId}?mode=view`;
    window.open(loadingUrl, "_blank");

    // 2. Redirigimos la página actual al detalle
    router.push(`/consignaciones/${consignacionId}`);
  };

  const handleClose = () => {
    if (consignacionId) router.push(`/consignaciones/${consignacionId}`);
  };

  const porcentajeAumento = consignacion?.porcentajeAumento || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10 px-4 sm:px-0">

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2 text-muted-foreground" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Consignación
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Nueva Liquidación</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="font-semibold text-primary border-primary/20">
              <User className="h-3 w-3 mr-1" /> {consignacion?.cliente?.nombre || "Cargando..."}
            </Badge>
            <Badge className={cn("uppercase text-[10px]", consignacion?.estado === "ABIERTA" ? "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/20" : "")}>
              {consignacion?.estado || "ESTADO"}
            </Badge>

            {porcentajeAumento > 0 && (
              <Badge className="bg-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)] gap-1">
                <BadgePercent className="h-3 w-3" />
                +{porcentajeAumento}% Aplicado
              </Badge>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="shadow-lg border-destructive/20">
          <AlertTitle className="text-sm font-bold flex items-center gap-2">
            Corregir errores
          </AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LISTADO DE ITEMS */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="shadow-md border-none overflow-hidden">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Productos en Consignación
              </CardTitle>
              <CardDescription>
                Ingresa las ventas. El stock devuelto se calcula automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-24 w-full bg-muted animate-pulse rounded-xl" />)}
                </div>
              ) : actionableRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/5 rounded-2xl border-2 border-dashed">
                  <CheckCircle2 className="h-12 w-12 text-[color:var(--status-success-strong)] mb-4" />
                  <p className="font-bold text-xl tracking-tight">No hay pendientes</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Todos los productos de esta consignación ya han sido liquidados.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {actionableRows.map((r) => {
                    return (
                      <div key={r.consignacionDetalleId} className="rounded-xl border hover:border-primary/30 bg-card shadow-sm transition-all p-5">

                        {/* INFO SUPERIOR DEL ITEM */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div className="space-y-1 flex-1">
                            <h3 className="font-bold text-lg leading-none italic">{r.productoNombre}</h3>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                              <span className="bg-muted px-2 py-0.5 rounded font-bold text-foreground/90">
                                Stock Disp: {r.maxPendiente}
                              </span>
                              <span>•</span>
                              <span className="font-bold text-[color:var(--status-success-strong)]">
                                {formatCurrency(r.precioFinal)} c/u
                              </span>
                            </div>
                          </div>

                          {/* PROGRESO VISUAL */}
                          <div className="flex flex-col items-end gap-1.5 min-w-[100px]">
                            <span className="text-sm font-black tracking-tighter text-primary">
                              {r.unitsVendidas} VEND / {r.unitsDevueltas} DEV
                            </span>
                            <Progress value={100} className="h-2 w-28 bg-[color:var(--status-warning)] [&>div]:bg-[color:var(--status-success-strong)]" />
                            {/* La barra de progreso aquí es conceptual: Verde es venta, el fondo (amber) es devolución */}
                          </div>
                        </div>

                        {/* INPUTS DE CARGA */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

                          {/* COLUMNA 1: VENDIDAS (EDITABLE) */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-end">
                              <Label className="text-[10px] uppercase font-black text-muted-foreground flex items-center gap-1.5">
                                <TrendingUp className="h-3 w-3 text-[color:var(--status-success-strong)]" /> Vendidas
                              </Label>
                              {r.unitsVendidas > 0 && (
                                <span className="text-[10px] font-bold text-[color:var(--status-success-strong)] animate-in fade-in">
                                  Subt: {formatCurrency((r.unitsVendidas * r.precioFinal) - r.descuento)}
                                </span>
                              )}
                              {r.descuento > 0 && (
                                <span className="text-[10px] font-bold text-[color:var(--primary)] animate-in fade-in ml-2">
                                  Desc: -{formatCurrency(r.descuento)}
                                </span>
                              )}
                            </div>

                            <Input
                              type="number"
                              className="h-12 text-lg font-bold bg-[color:var(--status-success-strong)]/10 border-[color:var(--status-success-strong)]/20 focus-visible:ring-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)] placeholder:text-[color:var(--status-success-strong)]/30"
                              placeholder="0"
                              min={0}
                              max={r.maxPendiente}
                              value={String(r.unitsVendidas)}
                              onChange={(e) => updateRow(r.consignacionDetalleId, e.target.value)}
                              disabled={saving}
                              // Evita escribir caracteres no numéricos
                              onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
                            />
                          </div>

                          {/* COLUMNA 2: DEVUELTAS (AUTOMÁTICO / READONLY) */}
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black text-muted-foreground flex items-center gap-1.5">
                              <Undo2 className="h-3 w-3 text-[color:var(--status-warning)]" /> Devueltas
                            </Label>
                            <Input
                              type="number"
                              className="h-12 text-lg font-bold bg-muted/30 border-none text-muted-foreground cursor-not-allowed"
                              value={String(r.unitsDevueltas)}
                              readOnly
                              tabIndex={-1} // Saltamos este input con TAB para ir directo a la siguiente venta
                            />
                            <p className="text-[9px] text-right text-muted-foreground/60 uppercase font-medium">
                              Se calcula automáticamente
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RESUMEN FINANCIERO (STICKY) */}
        <div className="lg:col-span-4">
          <Card className="sticky top-6 border-2 border-primary/20 bg-background shadow-2xl overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" /> Resumen Operativo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[color:var(--status-success-strong)] rounded-lg text-center border border-[color:var(--status-success-strong)]">
                  <p className="text-[10px] uppercase font-bold text-[color:var(--status-success-strong)] mb-1">A Cobrar</p>
                  <p className="text-xl font-black text-[color:var(--status-success-strong)]">{totalVendidoUnits} u.</p>
                </div>
                <div className="p-3 bg-[color:var(--status-warning)] rounded-lg text-center border border-[color:var(--status-warning)]">
                  <p className="text-[10px] uppercase font-bold text-[color:var(--status-warning)] mb-1">A Stock</p>
                  <p className="text-xl font-black text-[color:var(--status-warning)]">{totalDevueltoUnits} u.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground font-medium px-1">
                  <span>Subtotal bruto</span>
                  <span>{formatCurrency(totalDinero + totalDescuento)}</span>
                </div>
                <div className="flex justify-between text-sm text-[color:var(--primary)] font-bold px-1">
                  <span>Descuentos</span>
                  <span>- {formatCurrency(totalDescuento)}</span>
                </div>
              </div>

              <Separator className="bg-primary/10" />

              <div className="p-5 bg-primary/10 rounded-2xl border border-primary/20 space-y-1 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Receipt className="h-12 w-12 text-primary" />
                </div>
                <p className="text-[11px] uppercase font-black text-primary tracking-widest leading-none mb-1">Total a Liquidar</p>
                <p className="text-4xl font-black text-foreground tracking-tighter">
                  {formatCurrency(totalDinero)}
                </p>
                {porcentajeAumento > 0 && (
                  <p className="text-[10px] text-[color:var(--status-success-strong)] font-bold leading-tight pt-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Incluye +{porcentajeAumento}% de aumento
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  onClick={submit}
                  disabled={saving || actionableRows.length === 0}
                  className="w-full h-14 text-lg font-extrabold shadow-lg shadow-primary/20 group relative overflow-hidden"
                >
                  {saving ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      Finalizar Liquidación
                      <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </div>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-xs h-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Cancelar operación
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <SuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        onConfirm={handleDownload}
        onCancel={handleClose}
        title="¡Liquidación Exitosa!"
        description={
          <span>
            Se han procesado las ventas y devoluciones.<br />
            El stock y saldo del cliente han sido actualizados.
          </span>
        }
        confirmText="Descargar Comprobante"
        cancelText="Volver al Listado"
      />
    </div>
  );
}