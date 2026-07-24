"use client";

import * as React from "react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Command as CommandPrimitive } from "cmdk";
import {
  BadgePercent,
  Barcode,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Package,
  Search,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { DescuentoNivel } from "@/lib/types";
import type { ProductoConStock } from "../types";
import { formatCurrency } from "../utils";

interface ProductSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: ProductoConStock[];
  onSelectProduct: (producto: ProductoConStock) => void;
  // Paginación del servidor
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onSearchChange?: (search: string) => void;
  loadingProductos?: boolean;
}

export function ProductSearchModal({
  open,
  onOpenChange,
  productos,
  onSelectProduct,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  onSearchChange,
  loadingProductos = false,
}: ProductSearchModalProps) {
  const disponibles = productos.filter(
    (p) => (p.stockDisponibleUnits ?? 0) > 0,
  );
  const agotados = productos.filter((p) => (p.stockDisponibleUnits ?? 0) <= 0);

  // Debounce para no disparar un fetch por cada tecla
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const handleSearchInput = React.useCallback(
    (value: string) => {
      if (!onSearchChange) return;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 350);
    },
    [onSearchChange],
  );

  const handleSelect = (producto: ProductoConStock) => {
    if ((producto.stockDisponibleUnits ?? 0) <= 0) return;
    onSelectProduct(producto);
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Contenedor — ancho real sin interferencia de shadcn */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[90vw] max-w-2xl", // ancho real
            "rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden",
            "outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Buscar producto
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Buscá por nombre o código de barra
          </DialogPrimitive.Description>

          <Command
            filter={(value, search) => {
              const p = productos.find((item) => String(item.id) === value);
              if (!p) return 0;
              const q = search.toLowerCase();
              if (p.nombre.toLowerCase().includes(q)) return 1;
              if (p.codigoBarra?.toLowerCase().includes(q)) return 1;
              if (p.categoria?.nombre?.toLowerCase().includes(q)) return 1;
              return 0;
            }}
          >
            {/* ── Header ────────────────────────────────────────────────── */}
            <div className="flex items-center h-14 border-b border-border/60">
              {/* Ícono carrito */}
              <div className="flex items-center justify-center w-14 h-full shrink-0 border-r border-border/40">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>

              {/* Lupa + input — flex-1 real */}
              <div className="flex items-center gap-3 flex-1 px-4 h-full min-w-0">
                <Search className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <CommandPrimitive.Input
                  placeholder="Nombre del producto o código de barra..."
                  autoFocus
                  onValueChange={handleSearchInput}
                  className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none border-none ring-0 w-0 min-w-0"
                />
              </div>

              {/* Badge F1 */}
              <div className="hidden md:flex items-center gap-1.5 mr-4 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                <kbd className="text-[11px] font-black font-mono text-primary">
                  F1
                </kbd>
                <span className="text-[10px] text-primary/70 font-semibold">
                  buscar
                </span>
              </div>
            </div>

            {/* ── Lista ─────────────────────────────────────────────────── */}
            <CommandList className="p-2">
              <CommandEmpty>
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Package className="h-10 w-10 opacity-30" />
                  <p className="text-sm font-medium">
                    No se encontró ningún producto
                  </p>
                  <p className="text-xs opacity-60">
                    Probá con otro nombre o código
                  </p>
                </div>
              </CommandEmpty>

              {disponibles.length > 0 && (
                <CommandGroup
                  heading={
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                      Disponibles ({disponibles.length})
                    </span>
                  }
                >
                  {disponibles.map((p) => (
                    <ProductRow
                      key={p.id}
                      producto={p}
                      onSelect={handleSelect}
                    />
                  ))}
                </CommandGroup>
              )}

              {agotados.length > 0 && (
                <CommandGroup
                  heading={
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                      Sin stock ({agotados.length})
                    </span>
                  }
                >
                  {agotados.map((p) => (
                    <ProductRow
                      key={p.id}
                      producto={p}
                      onSelect={handleSelect}
                      disabled
                    />
                  ))}
                </CommandGroup>
              )}
            </CommandList>

            {/* ── Footer ────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-border/40 bg-muted/10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium">
                  {loadingProductos ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Cargando...
                    </span>
                  ) : (
                    `${productos.length} productos cargados`
                  )}
                </span>
                {totalPages > 1 && onPageChange && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1 || loadingProductos}
                      onClick={() => onPageChange(currentPage - 1)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted text-muted-foreground hover:bg-muted/70 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                      {currentPage}/{totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages || loadingProductos}
                      onClick={() => onPageChange(currentPage + 1)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-muted text-muted-foreground hover:bg-muted/70 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-4 items-center px-1 rounded border border-border bg-muted text-[9px] font-mono">
                    ↑↓
                  </kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-4 items-center px-1.5 rounded border border-border bg-muted text-[9px] font-mono">
                    ↵
                  </kbd>
                  agregar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-4 items-center px-1.5 rounded border border-border bg-muted text-[9px] font-mono">
                    Esc
                  </kbd>
                  cerrar
                </span>
              </div>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ── Fila de producto ──────────────────────────────────────────────────────────
function ProductRow({
  producto: p,
  onSelect,
  disabled = false,
}: {
  producto: ProductoConStock;
  onSelect: (p: ProductoConStock) => void;
  disabled?: boolean;
}) {
  const stock = p.stockDisponibleUnits ?? 0;
  const isLowStock = stock > 0 && stock <= (p.stockMinUnits ?? 5);
  const descuentos = p.subcategoria?.descuentos as
    DescuentoNivel[] | null | undefined;
  const hasDescuentos = Array.isArray(descuentos) && descuentos.length > 0;

  return (
    <CommandItem
      value={String(p.id)}
      disabled={disabled}
      onSelect={() => onSelect(p)}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors",
        "data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {/* Imagen */}
      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-muted border border-border/40 overflow-hidden flex items-center justify-center shrink-0 relative">
        {p.imagenUrl ? (
          <Image
            src={p.imagenUrl}
            alt={p.nombre}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="font-bold text-xs sm:text-sm text-foreground leading-tight line-clamp-2 sm:truncate">
          {p.nombre}
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {p.categoria?.nombre && (
            <span className="text-[10px] text-muted-foreground font-medium truncate">
              {p.categoria.nombre}
            </span>
          )}
          {hasDescuentos && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10 px-1 rounded border border-[color:var(--status-success-strong)]/30">
              <BadgePercent className="h-2.5 w-2.5" />
              {descuentos!.length} desc.
            </span>
          )}
          {p.codigoBarra && (
            <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono bg-muted px-1.5 rounded border border-border/40">
              <Barcode className="h-2.5 w-2.5" />
              {p.codigoBarra}
            </span>
          )}
        </div>
      </div>

      {/* Precio + stock */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="font-black text-sm text-primary tabular-nums">
          {formatCurrency(p.precioVenta)}
        </span>
        {disabled ? (
          <Badge
            variant="destructive"
            className="text-[9px] h-4 px-1.5 rounded-md font-black"
          >
            AGOTADO
          </Badge>
        ) : (
          <span
            className={cn(
              "text-[10px] font-bold px-1.5 rounded-md",
              isLowStock
                ? "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10"
                : "text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10",
            )}
          >
            {stock} uds.
          </span>
        )}
      </div>
    </CommandItem>
  );
}
