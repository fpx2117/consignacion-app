/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSucursalStore } from "@/store/useSucursalStore";
import type { PedidoEsperado } from "@/types/pedidos-esperados";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle2, PackageCheck, X } from "lucide-react";

interface ConfirmarPedidoDialogProps {
  pedido: PedidoEsperado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface CantidadItem {
  itemId: number;
  cantidadRecibida: number;
}

function formatFechaCorta(fechaISO: string) {
  if (!fechaISO) return "—";
  const d = new Date(fechaISO);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ConfirmarPedidoDialog({
  pedido,
  open,
  onOpenChange,
  onSuccess,
}: ConfirmarPedidoDialogProps) {
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const sucursalHeaders = React.useMemo(
    () => (activeSucursalId ? { "x-sucursal-id": String(activeSucursalId) } : {}),
    [activeSucursalId]
  );
  const [cantidades, setCantidades] = React.useState<CantidadItem[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Inicializar cantidades con cantidadEsperada al abrir
  React.useEffect(() => {
    if (pedido && open) {
      const pendientes = pedido.items.filter((it) => it.estado === "PENDIENTE" || it.estado === "PARCIAL");
      setCantidades(
        pendientes.map((it) => ({
          itemId: it.id,
          cantidadRecibida: it.cantidadEsperada,
        }))
      );
    }
  }, [pedido, open]);

  function setCantidadItem(itemId: number, valor: number) {
    setCantidades((prev) =>
      prev.map((c) => (c.itemId === itemId ? { ...c, cantidadRecibida: Math.max(0, valor) } : c))
    );
  }

  function confirmarTodo() {
    if (!pedido) return;
    const pendientes = pedido.items.filter((it) => it.estado === "PENDIENTE" || it.estado === "PARCIAL");
    setCantidades(
      pendientes.map((it) => ({
        itemId: it.id,
        cantidadRecibida: it.cantidadEsperada,
      }))
    );
  }

  const todosEnCero = cantidades.every((c) => c.cantidadRecibida === 0);
  const itemsPendientes = pedido?.items.filter((it) => it.estado === "PENDIENTE" || it.estado === "PARCIAL") ?? [];

  async function handleSubmit() {
    if (!pedido || todosEnCero || saving) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/pedidos-esperados/${pedido.id}/confirmar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...sucursalHeaders,
        },
        body: JSON.stringify({ items: cantidades }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al confirmar pedido");
      }

      toast.success("Llegada confirmada. Stock actualizado.");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al confirmar el pedido");
    } finally {
      setSaving(false);
    }
  }

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 pb-3 border-b bg-emerald-500/5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <PackageCheck className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold italic tracking-tight">Confirmar llegada del pedido</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Fecha esperada: <span className="font-bold text-foreground">{formatFechaCorta(pedido.fechaEsperada)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {itemsPendientes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
              <p className="font-medium">Todos los items ya fueron confirmados</p>
            </div>
          ) : (
            <>
              {/* Tabla desktop */}
              <div className="hidden sm:block rounded-xl border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-b border-border/60">
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground/70 pl-4">Producto</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground/70 text-center">Esperada</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground/70 text-center pr-4">Recibida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemsPendientes.map((it) => {
                      const cantObj = cantidades.find((c) => c.itemId === it.id);
                      const recibida = cantObj?.cantidadRecibida ?? it.cantidadEsperada;
                      return (
                        <TableRow key={it.id} className="border-b border-border/40 hover:bg-muted/20">
                          <TableCell className="pl-4 py-3">
                            <p className="font-semibold text-sm text-foreground">{it.producto.nombre}</p>
                            {it.producto.sku && (
                              <p className="text-[10px] font-mono text-muted-foreground">{it.producto.sku}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-bold text-foreground tabular-nums">{it.cantidadEsperada}</span>
                          </TableCell>
                          <TableCell className="text-center pr-4">
                            <Input
                              type="number"
                              min={0}
                              value={recibida}
                              onChange={(e) => setCantidadItem(it.id, Number(e.target.value))}
                              className={cn(
                                "w-24 h-9 text-center font-bold rounded-lg text-sm mx-auto",
                                recibida === 0
                                  ? "bg-red-500/10 border-red-500/20 text-red-600"
                                  : recibida < it.cantidadEsperada
                                  ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-700"
                                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Cards mobile */}
              <div className="sm:hidden space-y-3">
                {itemsPendientes.map((it) => {
                  const cantObj = cantidades.find((c) => c.itemId === it.id);
                  const recibida = cantObj?.cantidadRecibida ?? it.cantidadEsperada;
                  return (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-muted/10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{it.producto.nombre}</p>
                        <p className="text-xs text-muted-foreground">Esperado: {it.cantidadEsperada}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-bold">Recibido:</span>
                        <Input
                          type="number"
                          min={0}
                          value={recibida}
                          onChange={(e) => setCantidadItem(it.id, Number(e.target.value))}
                          className={cn(
                            "w-20 h-9 text-center font-bold rounded-lg text-sm",
                            recibida === 0
                              ? "bg-red-500/10 border-red-500/20 text-red-600"
                              : recibida < it.cantidadEsperada
                              ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-700"
                              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700"
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {todosEnCero && (
                <p className="text-sm text-red-500 font-bold text-center">
                  Ingresá al menos una cantidad recibida mayor a 0
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-6 pt-3 border-t bg-muted/10 flex-col sm:flex-row gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11 rounded-xl gap-2"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11 rounded-xl border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 gap-2"
            onClick={() => { confirmarTodo(); }}
            disabled={saving || itemsPendientes.length === 0}
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirmar Todo
          </Button>
          <Button
            type="button"
            className="flex-1 h-11 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 gap-2"
            onClick={handleSubmit}
            disabled={saving || todosEnCero || itemsPendientes.length === 0}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <PackageCheck className="h-4 w-4" />
                Confirmar Parcial
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
