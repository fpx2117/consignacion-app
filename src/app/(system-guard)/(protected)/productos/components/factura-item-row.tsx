// Fila de un ítem en la revisión de factura de proveedor.
//
// Extraída de factura-proveedor-dialog.tsx (M08) sin cambios de comportamiento.
// El JSX y los cálculos por ítem están copiados tal cual; lo único que cambia es
// que las dependencias del padre llegan por `ctx` en lugar de estar en el closure.

import * as React from "react";
import { AlertTriangle, Check, Loader2, PencilLine, Plus, Search, X } from "lucide-react";

import {
  apiService,
  type FacturaProveedorItem,
  type UpdateFacturaProveedorItemInput,
} from "@/lib/apiService";
import type { Producto } from "@/lib/types";
import { formatMoney } from "@/lib/date-format/utils-format";
import { digitosAMonto, formatearInputMonto } from "@/lib/money-input";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { EditProductoDialog } from "./edit-producto-dialog";
import {
  ESTADOS_TERMINALES,
  TABLE_ACTION_ICON_CLASS,
  badgeEstado,
  nivelConfianza,
} from "./factura-proveedor-helpers";

export type FacturaItemRowContext = {
  productos: Producto[];
  monedaFactura: string;
  puedeConvertir: boolean;
  convertirAArs: (valor: number | null | undefined) => number | null;
  formatearArs: (valor: number) => string;
  codigoYaEnDescripcion: (item: FacturaProveedorItem) => boolean;
  busyItemId: number | null;
  precioVentaBorrador: Record<number, number | null>;
  setPrecioVentaBorrador: React.Dispatch<
    React.SetStateAction<Record<number, number | null>>
  >;
  itemIdParaEditar: number | null;
  updateItem: (itemId: number, patch: Partial<FacturaProveedorItem>) => void;
  guardarCampoItem: (
    item: FacturaProveedorItem,
    patch: UpdateFacturaProveedorItemInput,
  ) => void;
  confirmarItem: (item: FacturaProveedorItem, productoIdElegido?: number) => void;
  ignorarItem: (item: FacturaProveedorItem) => void;
  setItemIdParaMatch: (id: number | null) => void;
  setItemParaCrear: (item: FacturaProveedorItem | null) => void;
  setItemIdParaEditar: (id: number | null) => void;
  setProductos: React.Dispatch<React.SetStateAction<Producto[]>>;
};

export type FacturaItemRowProps = {
  item: FacturaProveedorItem;
  ctx: FacturaItemRowContext;
};

export function FacturaItemRow({ item, ctx }: FacturaItemRowProps) {
  const {
    productos,
    monedaFactura,
    puedeConvertir,
    convertirAArs,
    formatearArs,
    codigoYaEnDescripcion,
    busyItemId,
    precioVentaBorrador,
    setPrecioVentaBorrador,
    itemIdParaEditar,
    updateItem,
    guardarCampoItem,
    confirmarItem,
    ignorarItem,
    setItemIdParaMatch,
    setItemParaCrear,
    setItemIdParaEditar,
    setProductos,
  } = ctx;

  const badge = badgeEstado(item);
  const BadgeIcon = badge.icon;
  const terminal = ESTADOS_TERMINALES.has(
    item.estado,
  );
  const busy = busyItemId === item.id;
  const mostrarCodigo =
    !codigoYaEnDescripcion(item);
  const costoArs = puedeConvertir
    ? convertirAArs(item.precioUnitario)
    : null;
  const requiereAlta = !item.productoId;
  const productoMatch = item.productoId
    ? productos.find(
        (p) => p.id === item.productoId,
      )
    : undefined;
  const conf = nivelConfianza(item);
  const confCls =
    conf.nivel === "excelente"
      ? "text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/12"
      : conf.nivel === "buena"
        ? "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/12"
        : "text-[color:var(--status-danger)] bg-[color:var(--status-danger)]/12";
  const bordeEstado =
    item.estado === "CONFIRMADO" ||
    item.estado === "PRODUCTO_CREADO"
      ? "border-l-[color:var(--status-success-strong)]"
      : item.estado === "SIN_COINCIDENCIA"
        ? "border-l-[color:var(--status-danger)]"
        : item.estado === "IGNORADO"
          ? "border-l-border"
          : "border-l-[color:var(--status-warning)]";
  const estadoLabel =
    item.estado === "CONFIRMADO"
      ? "Confirmado"
      : item.estado === "PRODUCTO_CREADO"
        ? "Creado"
        : item.estado === "SIN_COINCIDENCIA"
          ? "Sin match"
          : item.estado === "IGNORADO"
            ? "Ignorado"
            : item.estado === "REQUIERE_REVISION"
              ? "Revisar"
              : "Sugerido";

  return (
    <div
      key={item.id}
      className={cn(
        "grid grid-cols-1 gap-x-3 gap-y-2.5 border-l-4 px-4 py-3.5 transition-colors lg:grid-cols-[minmax(0,1fr)_72px_112px_112px_130px_auto] lg:items-center",
        bordeEstado,
        terminal
          ? "bg-muted/20 opacity-70"
          : "hover:bg-muted/25",
      )}
    >
      {/* Producto */}
      <div className="min-w-0 space-y-1.5">
        <Input
          aria-label={`Descripción detectada para línea ${item.id}`}
          value={item.textoOriginal}
          onChange={(e) =>
            updateItem(item.id, {
              textoOriginal: e.target.value,
            })
          }
          onBlur={(e) =>
            guardarCampoItem(item, {
              textoOriginal: e.target.value,
            })
          }
          disabled={terminal || busy}
          className="h-9 w-full rounded-lg border-border bg-background text-sm font-medium shadow-xs"
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {mostrarCodigo &&
            item.codigoProveedor && (
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                #{item.codigoProveedor}
              </span>
            )}
          {!terminal ? (
            <button
              type="button"
              aria-label={`Producto existente para ${item.textoOriginal}`}
              onClick={() =>
                setItemIdParaMatch(item.id)
              }
              disabled={busy}
              className={cn(
                "inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50",
                productoMatch
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Search className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">
                {productoMatch
                  ? productoMatch.nombre
                  : "Elegir producto"}
              </span>
            </button>
          ) : (
            productoMatch && (
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {productoMatch.nombre}
              </span>
            )
          )}
        </div>
      </div>

      {/* Cantidad */}
      <div className="flex items-center gap-2 lg:block">
        <Label className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Cantidad
        </Label>
        <Input
          aria-label={`Cantidad para ${item.textoOriginal}`}
          type="number"
          min={1}
          step="1"
          value={item.cantidad}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n))
              updateItem(item.id, {
                cantidad: n,
              });
          }}
          onBlur={(e) => {
            const n = Math.max(
              1,
              Math.trunc(
                Number(e.target.value) ||
                  item.cantidad,
              ),
            );
            guardarCampoItem(item, {
              cantidad: n,
            });
          }}
          disabled={terminal || busy}
          className="h-9 w-16 rounded-lg border-border bg-background px-2 text-center text-sm shadow-xs tabular-nums lg:w-full"
        />
      </div>

      {/* Costo unitario */}
      <div className="flex items-center gap-2 lg:block">
        <Label className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          Costo ({monedaFactura})
        </Label>
        <Input
          aria-label={`Costo unitario para ${item.textoOriginal} en ${monedaFactura}`}
          title={
            costoArs != null
              ? `${formatearArs(costoArs)} ARS`
              : undefined
          }
          type="text"
          inputMode="decimal"
          value={formatearInputMonto(
            item.precioUnitario,
          )}
          onChange={(e) =>
            updateItem(item.id, {
              precioUnitario: digitosAMonto(
                e.target.value,
              ),
            })
          }
          onBlur={() =>
            guardarCampoItem(item, {
              precioUnitario: item.precioUnitario,
            })
          }
          disabled={terminal || busy}
          placeholder="—"
          className="h-9 w-28 rounded-lg border-border bg-background px-2 text-sm shadow-xs tabular-nums lg:w-full"
        />
      </div>

      {/* Precio de venta */}
      <div className="flex items-center gap-2 lg:block">
        <Label className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
          P. venta
        </Label>
        {productoMatch ? (
          <div
            className="flex h-9 w-28 items-center rounded-lg border border-border bg-muted/40 px-2 text-sm font-semibold tabular-nums text-foreground lg:w-full"
            title="Precio de venta del producto existente — editalo con 'Editar producto'"
          >
            <span className="truncate">
              {formatMoney(
                Number(productoMatch.precioVenta),
              )}
            </span>
          </div>
        ) : (
          <Input
            aria-label={`Precio de venta para ${item.textoOriginal}`}
            type="text"
            inputMode="decimal"
            value={formatearInputMonto(
              precioVentaBorrador[item.id],
            )}
            onChange={(e) =>
              setPrecioVentaBorrador((prev) => ({
                ...prev,
                [item.id]: digitosAMonto(
                  e.target.value,
                ),
              }))
            }
            disabled={terminal || busy}
            placeholder="—"
            className="h-9 w-28 rounded-lg border-border bg-background px-2 text-sm shadow-xs tabular-nums lg:w-full"
          />
        )}
      </div>

      {/* Estado */}
      <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-start lg:gap-1">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-bold",
            confCls,
          )}
        >
          {conf.pct != null
            ? `${conf.pct}%`
            : "—"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-semibold",
            badge.cls,
          )}
        >
          <BadgeIcon className="h-3 w-3 shrink-0" />
          {estadoLabel}
        </span>
        {item.advertencias.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help items-center gap-1 text-[11px] text-[color:var(--status-warning)]">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Revisar
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={4}
              className="max-w-xs"
            >
              {item.advertencias.map(
                (advertencia, i) => (
                  <p key={i}>{advertencia}</p>
                ),
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Acciones */}
      <div className="lg:justify-self-end">
        {terminal ? (
          <span className="text-[11px] font-medium text-muted-foreground">
            Sin acciones
          </span>
        ) : (
          <div
            role="group"
            aria-label={`Acciones para ${item.textoOriginal}`}
            className="flex items-center gap-1.5"
          >
            {item.productoId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    aria-label={`Confirmar coincidencia para ${item.textoOriginal}`}
                    className={cn(
                      TABLE_ACTION_ICON_CLASS,
                      "border-[color:var(--status-success-strong)]/35 bg-[color:var(--status-success-strong)]/14 text-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)]/22",
                    )}
                    onClick={() =>
                      confirmarItem(item)
                    }
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={8}
                >
                  Confirmar coincidencia
                </TooltipContent>
              </Tooltip>
            )}

            {requiereAlta ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Crear producto para ${item.textoOriginal}`}
                    className={cn(
                      TABLE_ACTION_ICON_CLASS,
                      "border-primary/30 bg-primary/10 text-primary hover:bg-primary/18",
                    )}
                    onClick={() =>
                      setItemParaCrear(item)
                    }
                    disabled={busy}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={8}
                >
                  Crear producto nuevo con datos
                  precargados
                </TooltipContent>
              </Tooltip>
            ) : (
              productoMatch && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <EditProductoDialog
                      producto={productoMatch}
                      onUpdated={() =>
                        apiService
                          .getProductos()
                          .then(setProductos)
                          .catch(() => {})
                      }
                      open={
                        itemIdParaEditar ===
                        item.id
                      }
                      onOpenChange={(v) =>
                        setItemIdParaEditar(
                          v ? item.id : null,
                        )
                      }
                      trigger={
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label={`Editar producto existente para ${item.textoOriginal}`}
                          className={cn(
                            TABLE_ACTION_ICON_CLASS,
                            "border-primary/30 bg-primary/10 text-primary hover:bg-primary/18",
                          )}
                          disabled={busy}
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={8}
                  >
                    Editar el producto ya
                    existente que coincidió
                  </TooltipContent>
                </Tooltip>
              )
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Ignorar línea ${item.textoOriginal}`}
                  className={cn(
                    TABLE_ACTION_ICON_CLASS,
                    "border-border bg-transparent text-muted-foreground hover:border-[color:var(--status-warning)]/40 hover:bg-[color:var(--status-warning)]/10 hover:text-[color:var(--status-warning)]",
                  )}
                  onClick={() =>
                    ignorarItem(item)
                  }
                  disabled={busy}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={8}
              >
                Ignorar línea
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}
