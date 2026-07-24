"use client";

import * as React from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Loader2, X } from "lucide-react";
import { useTimezone } from "@/hooks/useTimezone";

interface PostergarPedidoDialogProps {
  pedido: PedidoEsperado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function getTomorrowStr(tz: string) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

function formatFechaCorta(fechaISO: string) {
  if (!fechaISO) return "—";
  const d = new Date(fechaISO);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PostergarPedidoDialog({
  pedido,
  open,
  onOpenChange,
  onSuccess,
}: PostergarPedidoDialogProps) {
  const { tz } = useTimezone();
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const sucursalHeaders = React.useMemo<Record<string, string>>(
    () =>
      activeSucursalId
        ? { "x-sucursal-id": String(activeSucursalId) }
        : ({} as Record<string, string>),
    [activeSucursalId],
  );
  const [nuevaFecha, setNuevaFecha] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setNuevaFecha("");
      setMotivo("");
    }
  }, [open]);

  const minFecha = getTomorrowStr(tz);
  const canSubmit = nuevaFecha !== "" && nuevaFecha >= minFecha;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pedido || !canSubmit || saving) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/pedidos-esperados/${pedido.id}/postergar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...sucursalHeaders,
        },
        body: JSON.stringify({
          nuevaFecha: `${nuevaFecha}T23:59:59.000Z`,
          motivo: motivo.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al postergar pedido");
      }

      toast.success("Pedido postergado correctamente");
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al postergar el pedido",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-[color:var(--theme-ocean-primary)] dark:text-[color:var(--theme-ocean-primary)]">
            <CalendarClock className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold italic tracking-tight">
              Postergar Pedido
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Fecha original:{" "}
            <span className="font-bold text-foreground">
              {formatFechaCorta(pedido.fechaEsperada)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* NUEVA FECHA */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              Nueva fecha estimada
            </Label>
            <Input
              type="date"
              min={minFecha}
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
              className="h-11 bg-muted/30 border-transparent text-sm"
            />
            {nuevaFecha && nuevaFecha < minFecha && (
              <p className="text-xs text-[color:var(--status-danger)] font-bold">
                La nueva fecha debe ser a partir de mañana
              </p>
            )}
          </div>

          {/* MOTIVO */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              Motivo de postergación{" "}
              <span className="normal-case font-normal text-muted-foreground/60">
                (opcional)
              </span>
            </Label>
            <Textarea
              placeholder="Ej: El proveedor avisó retraso en entrega..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="resize-none rounded-xl bg-muted/30 border-transparent min-h-[80px] text-sm focus:bg-background"
            />
          </div>

          <DialogFooter className="pt-2 gap-3 flex-col sm:flex-row">
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
              type="submit"
              className="flex-1 h-11 rounded-xl font-bold bg-[color:var(--theme-ocean-primary)] hover:bg-[color:var(--theme-ocean-primary)] text-[color:var(--ui-fx-white)] shadow-lg shadow-blue-500/20 gap-2"
              disabled={!canSubmit || saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CalendarClock className="h-4 w-4" />
                  Postergar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
