"use client";

import * as React from "react";
import { MotivoMovimientoStock, Producto, TipoMovimientoStock } from "@/lib/types";
import { apiService } from "@/lib/apiService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Asegúrate de tener este componente de shadcn
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  AlertTriangle,
  PackagePlus,
  TrendingDown,
  ClipboardPen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  producto: Producto;
  onUpdated: () => void;
  trigger: React.ReactNode;
}

type TipoMovimiento = "entrada" | "salida";

const ENTRY_REASONS = [
  { value: MotivoMovimientoStock.COMPRA, label: "Compra" },
  { value: MotivoMovimientoStock.DEVOLUCION_CLIENTE, label: "Devolución" },
  { value: MotivoMovimientoStock.AJUSTE_POSITIVO, label: "Ajuste Manual" },
] as const;

const EXIT_REASONS = [
  { value: MotivoMovimientoStock.ROTURA, label: "Rotura / Daño" },
  { value: MotivoMovimientoStock.VENCIMIENTO, label: "Vencido" },
  { value: MotivoMovimientoStock.PERDIDA, label: "Pérdida" },
  { value: MotivoMovimientoStock.AJUSTE_NEGATIVO, label: "Ajuste Manual" },
] as const;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AjustarStockDialog({ producto, onUpdated, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [cantidad, setCantidad] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(false);
  const [tipo, setTipo] = React.useState<TipoMovimiento>("entrada");
  const [motivo, setMotivo] = React.useState<MotivoMovimientoStock>(MotivoMovimientoStock.COMPRA);
  const [notas, setNotas] = React.useState("");

  // Limpiar formulario al cerrar
  React.useEffect(() => {
    if (!open) {
      setCantidad(0);
      setTipo("entrada");
      setMotivo(MotivoMovimientoStock.COMPRA);
      setNotas("");
    }
  }, [open]);

  const stockFinal = tipo === "entrada"
    ? producto.stockDisponibleUnits + (cantidad || 0)
    : Math.max(0, producto.stockDisponibleUnits - (cantidad || 0));

  async function handleAjuste() {
    if (cantidad <= 0) {
      toast.error("Ingresa una cantidad válida");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        stockDisponibleUnits: stockFinal,
        movimientoInfo: {
          tipo: tipo === "entrada" ? TipoMovimientoStock.ENTRADA : TipoMovimientoStock.SALIDA,
          motivo,
          observaciones: notas || `Ajuste manual: ${motivo.toLowerCase().replace(/_/g, " ")}`,
        },
      };

      await apiService.updateProducto(producto.id, payload);

      toast.success(`Stock actualizado: ${producto.stockDisponibleUnits} → ${stockFinal}`);
      onUpdated();
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo procesar el movimiento"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[420px] bg-background shadow-2xl rounded-2xl border-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold italic tracking-tight text-primary">
            Ajuste de Stock
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Producto: <span className="font-bold text-foreground">{producto.nombre}</span>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-5">
          {/* SIMULADOR VISUAL */}
          <div className="flex justify-around items-center bg-muted/20 p-4 rounded-xl border border-border/50 relative overflow-hidden">
            <div className="text-center relative z-10">
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Actual</p>
              <p className="text-2xl font-black tabular-nums">{producto.stockDisponibleUnits}</p>
            </div>

            <div className="flex flex-col items-center gap-1 opacity-60">
              {tipo === "entrada" ? (
                <ArrowUpCircle className="h-5 w-5 text-[color:var(--status-success-strong)]" />
              ) : (
                <ArrowDownCircle className="h-5 w-5 text-[color:var(--status-danger)]" />
              )}
              <span className="text-[10px] font-mono font-bold">
                {cantidad > 0 ? (tipo === "entrada" ? `+${cantidad}` : `-${cantidad}`) : "---"}
              </span>
            </div>

            <div className="text-center relative z-10">
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Final</p>
              <p className={cn(
                "text-2xl font-black transition-all tabular-nums",
                cantidad > 0 ? (tipo === "entrada" ? "text-[color:var(--status-success-strong)] scale-110" : "text-[color:var(--status-danger)] scale-110") : "text-primary"
              )}>
                {stockFinal}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* TIPO */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold opacity-70 ml-1">Operación</Label>
              <Select
                value={tipo}
                onValueChange={(value) => {
                  const nextTipo = value as TipoMovimiento;
                  setTipo(nextTipo);
                  setMotivo(nextTipo === "entrada" ? MotivoMovimientoStock.COMPRA : MotivoMovimientoStock.ROTURA);
                }}
              >
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-transparent focus:ring-primary/20 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="entrada" className="text-[color:var(--status-success-strong)] font-bold focus:bg-[color:var(--status-success-strong)] focus:text-[color:var(--status-success-strong)]">Entrada (+)</SelectItem>
                  <SelectItem value="salida" className="text-[color:var(--status-danger)] font-bold focus:bg-[color:var(--status-danger)] focus:text-[color:var(--status-danger)]">Salida (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold opacity-70 ml-1">Motivo</Label>
              <Select value={motivo} onValueChange={(value) => setMotivo(value as MotivoMovimientoStock)}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-transparent font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {tipo === "entrada" ? (
                    <>
                      {ENTRY_REASONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </>
                  ) : (
                    <>
                      {EXIT_REASONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* CANTIDAD */}
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <Label htmlFor="cantidad" className="text-[10px] uppercase font-bold opacity-70">Unidades</Label>
              {tipo === "salida" && cantidad > producto.stockDisponibleUnits && (
                <span className="text-[9px] text-[color:var(--status-danger)] font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="h-3 w-3" /> STOCK INSUFICIENTE
                </span>
              )}
            </div>
            <Input
              id="cantidad"
              type="number"
              placeholder="0"
              value={cantidad || ""}
              onChange={(e) => setCantidad(Math.abs(Number(e.target.value)))}
              className="text-2xl h-14 text-center font-black rounded-xl bg-muted/30 border-transparent transition-all focus:bg-background focus:border-primary/20"
              min="0"
            />
          </div>

          {/* NOTAS OPCIONALES */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-70 ml-1 flex items-center gap-1">
              <ClipboardPen className="h-3 w-3" /> Observaciones
            </Label>
            <Textarea
              placeholder="Ej: Llegó caja dañada del transporte..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="resize-none rounded-xl bg-muted/30 border-transparent min-h-[80px] text-sm focus:bg-background focus:border-primary/20"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            disabled={loading || cantidad <= 0}
            onClick={handleAjuste}
            className={cn(
              "w-full h-12 rounded-xl text-[color:var(--ui-fx-white)] font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95",
              tipo === "entrada"
                ? "bg-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)] shadow-emerald-500/20"
                : "bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] shadow-red-500/20"
            )}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                {tipo === "entrada" ? <PackagePlus className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                Confirmar {tipo === "entrada" ? "Ingreso" : "Egreso"}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
