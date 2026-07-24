"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  TrendingUp,
  Undo2,
  Info,
  BadgePercent, // Importamos el icono
} from "lucide-react";

import { apiService } from "@/lib/apiService";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import type {
  Consignacion,
  ConsignacionDetalle,
  Liquidacion,
  LiquidacionItem,
  Producto,
} from "@/lib/types";

// Dialogs
import { SuccessDialog } from "@/components/feedback/success-dialog";
import { ErrorDialog } from "@/components/feedback/error-dialog";

type EditableLiquidacionItem = {
  consignacionDetalleId: number;
  productoNombre: string;
  precioUnitario: number; // Precio BASE
  unitsVendidas: number;
  unitsDevueltas: number;
  maxDisponibleParaEstaEdicion: number;
};

type LiquidacionDetalleEditable = ConsignacionDetalle & {
  producto?: Producto;
};

type LiquidacionItemEditable = LiquidacionItem & {
  detalle?: LiquidacionDetalleEditable | null;
  consignacionDetalle?: LiquidacionDetalleEditable | null;
};

type LiquidacionEditable = Liquidacion & {
  consignacion?: Consignacion | null;
  items?: LiquidacionItemEditable[];
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const clampInt = (n: number) => {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
};

// Helper de moneda
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function EditarLiquidacionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const liquidacionId = Number(params.id);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [items, setItems] = React.useState<EditableLiquidacionItem[]>([]);
  const [consignacionId, setConsignacionId] = React.useState<number>();

  // 1. ESTADO PARA EL PORCENTAJE
  const [porcentajeAumento, setPorcentajeAumento] = React.useState<number>(0);

  const [showSuccess, setShowSuccess] = React.useState(false);
  const [errorDialog, setErrorDialog] = React.useState({
    open: false,
    title: "",
    description: "",
  });

  const loadData = React.useCallback(async () => {
    if (!liquidacionId) return;
    setLoading(true);

    try {
      const liq = (await apiService.getLiquidacion(
        liquidacionId,
      )) as LiquidacionEditable | null;

      if (!liq) throw new Error("No se encontró la liquidación");

      setConsignacionId(liq.consignacionId);

      if (liq.consignacion) {
        setPorcentajeAumento(liq.consignacion.porcentajeAumento || 0);
      } else {
        const cons = await apiService.getConsignacion(liq.consignacionId);
        setPorcentajeAumento(cons.porcentajeAumento || 0);
      }

      const mappedItems: EditableLiquidacionItem[] = (
        (liq.items || []) as LiquidacionItemEditable[]
      ).map((item) => {
        const det = item.detalle || item.consignacionDetalle;

        if (!det) {
          throw new Error("La liquidación tiene items sin detalle asociado.");
        }

        const pendienteActual =
          (det.unitsEntregadas ?? 0) -
          (det.unitsVendidasAcum ?? 0) -
          (det.unitsDevueltasAcum ?? 0);

        const vend = item.unitsVendidas ?? 0;
        const dev = item.unitsDevueltas ?? 0;
        const maxUnidades = pendienteActual + vend + dev;

        return {
          consignacionDetalleId: item.consignacionDetalleId,
          productoNombre: det.producto?.nombre || "Producto",
          precioUnitario: Number(
            det.producto?.precioVenta ?? item.precioUnitario ?? 0,
          ),
          unitsVendidas: vend,
          unitsDevueltas: dev,
          maxDisponibleParaEstaEdicion: Math.max(0, maxUnidades),
        };
      });

      setItems(mappedItems);
    } catch (error) {
      setErrorDialog({
        open: true,
        title: "Error de carga",
        description: getErrorMessage(
          error,
          "No se pudo cargar la liquidación.",
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [liquidacionId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleUpdate = (
    detalleId: number,
    field: "unitsVendidas" | "unitsDevueltas",
    value: number,
  ) => {
    const nextVal = clampInt(value);

    setItems((prev) =>
      prev.map((item) => {
        if (item.consignacionDetalleId !== detalleId) return item;
        const max = item.maxDisponibleParaEstaEdicion;

        if (field === "unitsVendidas") {
          const vend = Math.min(nextVal, max);
          const dev = max - vend;
          return { ...item, unitsVendidas: vend, unitsDevueltas: dev };
        }

        if (field === "unitsDevueltas") {
          const dev = Math.min(nextVal, max);
          const vend = max - dev;
          return { ...item, unitsVendidas: vend, unitsDevueltas: dev };
        }

        return item;
      }),
    );
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    for (const item of items) {
      if (
        item.unitsVendidas + item.unitsDevueltas >
        item.maxDisponibleParaEstaEdicion
      ) {
        setErrorDialog({
          open: true,
          title: "Excede el stock",
          description: `En "${item.productoNombre}", excedes el límite disponible.`,
        });
        return;
      }
    }

    setSaving(true);
    try {
      await apiService.updateLiquidacion(liquidacionId, {
        items: items.map((i) => ({
          consignacionDetalleId: i.consignacionDetalleId,
          unitsVendidas: i.unitsVendidas,
          unitsDevueltas: i.unitsDevueltas,
        })),
      });

      setShowSuccess(true);
    } catch (error) {
      setErrorDialog({
        open: true,
        title: "Error al guardar",
        description: getErrorMessage(
          error,
          "No se pudieron guardar los cambios.",
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  // 3. CÁLCULO DE TOTALES APLICANDO EL AUMENTO
  const calcularPrecioConAumento = (precioBase: number) => {
    return precioBase * (1 + porcentajeAumento / 100);
  };

  const totalVenta = items.reduce(
    (acc, item) =>
      acc + item.unitsVendidas * calcularPrecioConAumento(item.precioUnitario),
    0,
  );

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground italic">
          Obteniendo datos...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="w-fit -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Button>

        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black">Corregir Liquidación</h1>
          <Badge
            variant="outline"
            className="border-[color:var(--status-warning)]/30 text-[color:var(--status-warning)]"
          >
            #{liquidacionId}
          </Badge>
          {/* BADGE DE AUMENTO */}
          {porcentajeAumento > 0 && (
            <Badge className="bg-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)] gap-1">
              <BadgePercent className="h-3 w-3" />+{porcentajeAumento}% Aumento
            </Badge>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const precioFinal = calcularPrecioConAumento(item.precioUnitario);

            return (
              <Card key={item.consignacionDetalleId}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg">{item.productoNombre}</h3>

                    {/* VISUALIZACIÓN DE PRECIOS */}
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground line-through">
                        Base: {formatMoney(item.precioUnitario)}
                      </div>
                      <div className="text-sm font-bold text-[color:var(--status-success-strong)]">
                        {formatMoney(precioFinal)}{" "}
                        <span className="text-[10px] text-[color:var(--status-success-strong)] font-normal">
                          /u
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[color:var(--status-success-strong)] uppercase flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Vendidas
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          value={item.unitsVendidas}
                          onChange={(e) =>
                            handleUpdate(
                              item.consignacionDetalleId,
                              "unitsVendidas",
                              Number(e.target.value),
                            )
                          }
                          className="h-12 text-lg font-bold bg-[color:var(--status-success-strong)]/5 border-[color:var(--status-success-strong)]"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[color:var(--status-success-strong)]">
                          {formatMoney(item.unitsVendidas * precioFinal)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-[color:var(--status-warning)] uppercase flex items-center gap-2">
                        <Undo2 className="h-4 w-4" /> Devueltas
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.unitsDevueltas}
                        onChange={(e) =>
                          handleUpdate(
                            item.consignacionDetalleId,
                            "unitsDevueltas",
                            Number(e.target.value),
                          )
                        }
                        className="h-12 text-lg font-bold bg-[color:var(--status-warning)]/5 border-[color:var(--status-warning)]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 p-2 rounded">
                    <Info className="h-3.5 w-3.5" />
                    Máx. editable: {item.maxDisponibleParaEstaEdicion} u.
                    <span className="ml-auto font-mono">
                      (Total: {item.unitsVendidas + item.unitsDevueltas})
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card className="sticky top-6 border-primary/20 shadow-xl overflow-hidden bg-card">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="text-sm font-bold uppercase">
                Resumen de Ajuste
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">
                    Nuevo Total
                  </span>
                  {porcentajeAumento > 0 && (
                    <span className="text-[10px] text-[color:var(--status-success-strong)] font-bold">
                      Incluye +{porcentajeAumento}%
                    </span>
                  )}
                </div>
                <span className="text-3xl font-black">
                  {formatMoney(totalVenta)}
                </span>
              </div>

              <Separator />

              <p className="text-[11px] text-muted-foreground italic bg-[color:var(--status-warning)]/5 p-3 border border-[color:var(--status-warning)]/30 rounded-lg text-center">
                Al guardar, se recalculará el saldo del cliente usando los
                precios con el aumento aplicado.
              </p>

              <Button
                className="w-full h-14 text-lg font-bold"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Save className="mr-2 h-5 w-5" />
                )}{" "}
                Guardar Cambios
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <SuccessDialog
        open={showSuccess}
        onOpenChange={setShowSuccess}
        title="Corrección Exitosa"
        description="Se han recalculado los stocks y el saldo del cliente correctamente."
        onConfirm={() => router.push(`/consignaciones/${consignacionId}`)}
        onCancel={() => router.push("/consignaciones")}
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(o) => setErrorDialog((p) => ({ ...p, open: o }))}
        title={errorDialog.title}
        description={errorDialog.description}
      />
    </div>
  );
}
