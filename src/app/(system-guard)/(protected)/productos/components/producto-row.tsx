// Fila de tabla y tarjeta móvil de la vista de productos.
//
// Extraídas de productos-view.tsx (M08) sin cambios de comportamiento.

import * as React from "react";
import { motion } from "motion/react";
import Image from "next/image";
import {
  ArrowRightLeft,
  Barcode,
  Calendar,
  MoreVertical,
  Package,
  Pencil,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/date-format/utils-format";
import {
  formatDateSafe,
  isExpired as dateExpired,
  isExpiringSoon,
} from "@/lib/date-format/utils-date";
import {
  getCategoryColorByKey,
  getCategoryColorByName,
} from "@/lib/category-colors";
import { calcularDescuentoEfectivo } from "@/lib/storefront/descuento-utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TableCell } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DeleteButton } from "./productos-stats";
import { EditProductoDialog } from "./edit-producto-dialog";
import { AjustarStockDialog } from "./ajustar-stock-dialog";
import { COLUMNA_VENCIMIENTO, type ProductoViewItem } from "./productos-view-types";

export function ProductoRow({
  p,
  idx,
  load,
  isLow,
  isOut,
  columnasAtributos,
  mostrarNombreProducto,
}: {
  p: ProductoViewItem;
  idx: number;
  load: () => void;
  isLow: boolean;
  isOut: boolean;
  columnasAtributos: string[];
  mostrarNombreProducto: boolean;
}) {
  const desc = React.useMemo(
    () =>
      calcularDescuentoEfectivo({
        descuentoActivo: p.descuentoActivo ?? false,
        tipoDescuento: p.tipoDescuento,
        descuentoPorcentaje: p.descuentoPorcentaje ?? 0,
        descuentoMonto: p.descuentoMonto ?? 0,
        descuentoDesde: p.descuentoDesde ?? null,
        descuentoHasta: p.descuentoHasta ?? null,
        precioVenta: Number(p.precioVenta),
      }),
    [
      p.descuentoActivo,
      p.tipoDescuento,
      p.descuentoPorcentaje,
      p.descuentoMonto,
      p.descuentoDesde,
      p.descuentoHasta,
      p.precioVenta,
    ],
  );

  const precioEfectivo = desc?.precioFinal ?? Number(p.precioVenta);
  const tieneDescuento = desc !== null;
  const margenEfectivo = precioEfectivo - Number(p.precioCosto);
  return (
    <motion.tr
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className="group border-b border-border/40 hover:bg-muted/30 transition-colors"
    >
      <TableCell
        className={cn(
          "pl-6 py-4 max-w-0",
          mostrarNombreProducto ? "w-[30%]" : "w-16",
        )}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-12 w-12 rounded-lg bg-muted/50 border border-border/60 overflow-hidden flex items-center justify-center shrink-0 relative">
            {p.imagenUrl ? (
              <Image
                src={p.imagenUrl}
                alt={p.nombre}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            )}
          </div>
          {/* Si el nombre se auto-compone desde las columnas del rubro
              (Marca+Línea+Concentración...), mostrarlo acá de nuevo repite
              exactamente esas columnas — la celda queda solo con la imagen.
              El código de barras, cuando existe, sigue siendo buscable desde
              el buscador de arriba. */}
          {mostrarNombreProducto && (
            <div className="flex flex-col gap-1 min-w-0">
              <span
                className="font-bold text-foreground text-sm leading-none group-hover:text-primary transition-colors truncate"
                title={p.nombre}
              >
                {p.nombre}
              </span>
              <div className="flex items-center gap-2 pt-1">
                {p.codigoBarra ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 px-1.5 font-mono text-muted-foreground border-border/60 bg-background/50 gap-1 rounded-md"
                  >
                    <Barcode className="h-3 w-3 opacity-50" /> {p.codigoBarra}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground/40 italic">
                    Sin código
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </TableCell>

      {columnasAtributos
        .filter((clave) => clave !== COLUMNA_VENCIMIENTO)
        .map((clave) => (
          <TableCell
            key={clave}
            className="text-center text-sm text-muted-foreground"
          >
            {(p.atributosExtra as Record<string, string> | null | undefined)?.[
              clave
            ] ?? "—"}
          </TableCell>
        ))}

      <TableCell className="text-left">
        <div className="flex flex-col gap-1">
          {(() => {
            const catName = p.categoria?.nombre || "General";
            const color = p.categoria?.color
              ? getCategoryColorByKey(p.categoria.color)
              : getCategoryColorByName(catName);
            return (
              <Badge
                variant="secondary"
                className={cn(
                  "px-2.5 py-0.5 rounded-lg font-bold text-[10px] border uppercase tracking-tight gap-1.5 w-fit",
                  color.bg,
                  color.text,
                  color.border,
                )}
              >
                <div className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                {catName}
              </Badge>
            );
          })()}
          {/* Si ya se muestra la columna "marca", la subcategoría suele
              repetir la misma info (ver openspec/columnas-fijas-por-rubro) */}
          {p.subcategoria && !columnasAtributos.includes("marca") && (
            <span className="text-[10px] text-muted-foreground font-medium ml-1">
              {p.subcategoria.nombre}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell className="text-center">
        {isOut ? (
          <Badge
            variant="destructive"
            className="rounded-full px-2 py-0 text-[10px] font-black uppercase"
          >
            Agotado
          </Badge>
        ) : isLow ? (
          <Badge className="bg-[color:var(--status-warning)] hover:bg-[color:var(--status-warning)] rounded-full px-2 py-0 text-[10px] font-black uppercase">
            Bajo Stock
          </Badge>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)]">
            <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-success-strong)] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-tight">
              Disponible
            </span>
          </div>
        )}
      </TableCell>

      <TableCell className="text-center">
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            isOut
              ? "text-destructive"
              : isLow
                ? "text-[color:var(--status-warning)]"
                : "text-foreground",
          )}
        >
          {p.stockDisponibleUnits}
        </span>
      </TableCell>

      {columnasAtributos.includes(COLUMNA_VENCIMIENTO) && (
        <TableCell className="text-center">
          {(() => {
            if (!p.fechaVencimiento)
              return (
                <span className="text-[10px] text-muted-foreground/40 italic">
                  Sin venc.
                </span>
              );
            const expired = dateExpired(p.fechaVencimiento);
            const soon = isExpiringSoon(p.fechaVencimiento);
            return (
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className={cn(
                    "text-xs font-bold tabular-nums flex items-center gap-1",
                    expired
                      ? "text-[color:var(--status-danger)]"
                      : soon
                        ? "text-[color:var(--status-warning)]"
                        : "text-muted-foreground",
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {formatDateSafe(p.fechaVencimiento)}
                </span>
                {expired && (
                  <span className="text-[9px] font-black text-[color:var(--status-danger)] uppercase">
                    Vencido
                  </span>
                )}
                {soon && (
                  <span className="text-[9px] font-black text-[color:var(--status-warning)] uppercase">
                    Pronto
                  </span>
                )}
              </div>
            );
          })()}
        </TableCell>
      )}

      <TableCell className="text-right pr-6">
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            {tieneDescuento && (
              <span className="text-[9px] font-black text-destructive bg-destructive/10 px-1 py-0.5 rounded-full leading-none">
                -{desc.porcentaje}%
              </span>
            )}
            <span
              className={cn(
                "font-black text-foreground text-sm tabular-nums",
                tieneDescuento && "line-through text-muted-foreground/60",
              )}
            >
              {formatMoney(p.precioVenta)}
            </span>
            {tieneDescuento && (
              <span className="font-black text-destructive text-sm tabular-nums">
                {formatMoney(precioEfectivo)}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 rounded-md tabular-nums",
              margenEfectivo < 0
                ? "text-destructive bg-destructive/10"
                : tieneDescuento
                  ? "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10"
                  : "text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10",
            )}
          >
            Margen: {formatMoney(margenEfectivo)}
          </span>
        </div>
      </TableCell>

      <TableCell className="text-right pr-6">
        {/* ACCIONES INLINE (SIN DROPDOWN) */}
        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <AjustarStockDialog
            producto={p}
            onUpdated={load}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[color:var(--status-warning)] hover:bg-[color:var(--status-warning)] dark:hover:bg-[color:var(--status-warning)]/30 rounded-lg"
                title="Ajustar Stock"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            }
          />
          <EditProductoDialog
            producto={p}
            onUpdated={load}
            onCategoriasChanged={load}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[color:var(--theme-ocean-primary)] hover:bg-[color:var(--theme-ocean-primary)] dark:hover:bg-[color:var(--theme-ocean-primary)]/30 rounded-lg"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <DeleteButton
            id={p.id}
            nombre={p.nombre}
            onDeleted={load}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] dark:hover:bg-[color:var(--status-danger)]/30 rounded-lg"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </TableCell>
    </motion.tr>
  );
}

export function MobileProductCard({
  p,
  idx,
  load,
  isLow,
  isOut,
  columnasAtributos,
  labelAtributoFijo,
}: {
  p: ProductoViewItem;
  idx: number;
  load: () => void;
  isLow: boolean;
  isOut: boolean;
  columnasAtributos: string[];
  labelAtributoFijo: Map<string, string>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Card className="p-4 bg-card border-border/50 shadow-sm rounded-2xl relative overflow-hidden space-y-3">
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1.5",
            isOut
              ? "bg-[color:var(--status-danger)]"
              : isLow
                ? "bg-[color:var(--status-warning)]"
                : "bg-[color:var(--status-success-strong)]",
          )}
        />

        <div className="flex justify-between items-start pl-3 gap-3">
          <div className="h-14 w-14 rounded-xl bg-muted/50 border border-border/60 overflow-hidden flex items-center justify-center shrink-0 relative">
            {p.imagenUrl ? (
              <Image
                src={p.imagenUrl}
                alt={p.nombre}
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-bold text-foreground text-sm leading-tight">
              {p.nombre}
            </h3>
            <div className="flex items-center gap-2">
              {(() => {
                const catName = p.categoria?.nombre || "General";
                const color = p.categoria?.color
                  ? getCategoryColorByKey(p.categoria.color)
                  : getCategoryColorByName(catName);
                return (
                  <div className="flex flex-col gap-0.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] h-5 px-1.5 font-bold border rounded-md gap-1 w-fit",
                        color.bg,
                        color.text,
                        color.border,
                      )}
                    >
                      <div
                        className={cn("h-1.5 w-1.5 rounded-full", color.dot)}
                      />
                      {catName}
                    </Badge>
                    {p.subcategoria && !columnasAtributos.includes("marca") && (
                      <span className="text-[10px] text-muted-foreground font-medium ml-1">
                        {p.subcategoria.nombre}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="text-right">
            <span className="block font-black text-lg text-primary tabular-nums">
              {formatMoney(p.precioVenta)}
            </span>
            {p.codigoBarra && (
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {p.codigoBarra}
              </span>
            )}
          </div>
        </div>

        {p.fechaVencimiento &&
          (() => {
            const expired = dateExpired(p.fechaVencimiento);
            const soon = isExpiringSoon(p.fechaVencimiento);
            return (
              <div
                className={cn(
                  "flex items-center gap-1.5 pl-3 text-[11px] font-bold",
                  expired
                    ? "text-[color:var(--status-danger)]"
                    : soon
                      ? "text-[color:var(--status-warning)]"
                      : "text-muted-foreground",
                )}
              >
                <Calendar className="h-3 w-3" />
                Vence: {formatDateSafe(p.fechaVencimiento)}
                {expired && (
                  <Badge
                    variant="destructive"
                    className="text-[9px] h-4 px-1 rounded-md ml-1"
                  >
                    Vencido
                  </Badge>
                )}
                {soon && (
                  <Badge className="bg-[color:var(--status-warning)] text-[9px] h-4 px-1 rounded-md ml-1">
                    Pronto
                  </Badge>
                )}
              </div>
            );
          })()}

        {columnasAtributos.length > 0 &&
          (() => {
            const atributos =
              (p.atributosExtra as Record<string, string> | null | undefined) ??
              {};
            const chips = columnasAtributos.filter((clave) => atributos[clave]);
            if (chips.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1 pl-3">
                {chips.map((clave) => (
                  <Badge
                    key={clave}
                    variant="outline"
                    className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground border-border/60 bg-background/50 rounded-md capitalize"
                  >
                    {labelAtributoFijo.get(clave) ?? clave}: {atributos[clave]}
                  </Badge>
                ))}
              </div>
            );
          })()}

        <div className="flex items-center justify-between pl-3 pr-1 pt-2 border-t border-dashed border-border/50 mt-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1",
                isOut
                  ? "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)]"
                  : isLow
                    ? "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]"
                    : "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]",
              )}
            >
              <Package className="h-3.5 w-3.5" />
              {p.stockDisponibleUnits} uds.
            </span>
          </div>

          {/* â”€â”€ DROPDOWN DE ACCIONES (Mobile) â”€â”€ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl border-border/60"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-xl border-border/60 shadow-xl"
            >
              {/* Ajustar Stock */}
              <AjustarStockDialog
                producto={p}
                onUpdated={load}
                trigger={
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 font-semibold text-[color:var(--status-warning)] dark:text-[color:var(--status-warning)] cursor-pointer rounded-lg focus:text-[color:var(--status-warning)] focus:bg-[color:var(--status-warning)] dark:focus:bg-[color:var(--status-warning)]/40"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Ajustar Stock
                  </DropdownMenuItem>
                }
              />
              {/* Editar */}
              <EditProductoDialog
                producto={p}
                onUpdated={load}
                onCategoriasChanged={load}
                trigger={
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 font-semibold text-[color:var(--theme-ocean-primary)] dark:text-[color:var(--theme-ocean-primary)] cursor-pointer rounded-lg focus:text-[color:var(--theme-ocean-primary)] focus:bg-[color:var(--theme-ocean-primary)] dark:focus:bg-[color:var(--theme-ocean-primary)]/40"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar Producto
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuSeparator />
              {/* Eliminar */}
              <DeleteButton
                id={p.id}
                nombre={p.nombre}
                onDeleted={load}
                trigger={
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 font-semibold text-[color:var(--status-danger)] dark:text-[color:var(--status-danger)] cursor-pointer rounded-lg focus:text-[color:var(--status-danger)] focus:bg-[color:var(--status-danger)] dark:focus:bg-[color:var(--status-danger)]/40"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </motion.div>
  );
}

