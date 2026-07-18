"use client";

import * as React from "react";
import Image from "next/image";
import { Command as CommandPrimitive } from "cmdk";
import {
  Barcode,
  Check,
  Image as ImageIcon,
  Package,
  Search,
  XCircle,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/date-format/utils-format";
import { cn } from "@/lib/utils";
import type { Producto } from "@/lib/types";

interface SeleccionarProductoExistenteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: Producto[];
  productoIdSeleccionado: number | null;
  onSelect: (productoId: number | null) => void;
}

// Modal de búsqueda para vincular una línea de factura a un producto existente.
// Reemplaza el <Select> plano (lista interminable) por el mismo patrón de
// búsqueda por Command que ya usa el selector de clientes/productos de ventas.
export function SeleccionarProductoExistenteDialog({
  open,
  onOpenChange,
  productos,
  productoIdSeleccionado,
  onSelect,
}: SeleccionarProductoExistenteDialogProps) {
  const handleSelectSinProducto = () => {
    onSelect(null);
    onOpenChange(false);
  };

  const handleSelectProducto = (id: number) => {
    onSelect(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 rounded-2xl border-border/60 shadow-2xl overflow-hidden w-[min(92vw,560px)] max-w-none sm:max-w-none"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Buscar producto existente</DialogTitle>
          <DialogDescription>
            Buscá por nombre, categoría o código de barras para vincular esta
            línea a un producto ya cargado
          </DialogDescription>
        </DialogHeader>

        <Command
          filter={(value, search) => {
            if (value === "sin-producto") {
              return search === ""
                ? 1
                : "sin producto crear nuevo".includes(search.toLowerCase())
                  ? 1
                  : 0;
            }
            const producto = productos.find((p) => String(p.id) === value);
            if (!producto) return 0;
            const q = search.toLowerCase();
            if (producto.nombre.toLowerCase().includes(q)) return 1;
            if (producto.categoria?.nombre?.toLowerCase().includes(q)) return 1;
            if (producto.codigoBarra?.toLowerCase().includes(q)) return 1;
            return 0;
          }}
          className="bg-background w-full"
        >
          <div className="flex items-center h-14 border-b border-border/60 bg-background">
            <div className="flex items-center justify-center w-14 h-full shrink-0 border-r border-border/40">
              <Package className="h-5 w-5 text-primary" />
            </div>

            <div className="flex-1 flex items-center gap-3 px-4 min-w-0 overflow-hidden">
              <Search className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              <CommandPrimitive.Input
                placeholder="Nombre, categoría o código de barras..."
                autoFocus
                className="w-full h-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none border-0"
              />
            </div>
          </div>

          <CommandList className="max-h-[60vh] overflow-y-auto p-2">
            <CommandEmpty>
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Package className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">
                  No se encontró ningún producto
                </p>
              </div>
            </CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="sin-producto"
                onSelect={handleSelectSinProducto}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer",
                  "data-[selected=true]:bg-primary/10",
                  productoIdSeleccionado === null && "bg-primary/5",
                )}
              >
                <div className="h-10 w-10 rounded-full bg-muted border border-border/50 flex items-center justify-center shrink-0">
                  <XCircle className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">
                    Sin producto (crear nuevo)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Da de alta un producto a partir de esta línea
                  </p>
                </div>
                {productoIdSeleccionado === null && (
                  <Check
                    className="h-4 w-4 text-primary shrink-0"
                    aria-hidden="true"
                  />
                )}
              </CommandItem>
            </CommandGroup>

            <CommandSeparator className="my-1" />

            <CommandGroup
              heading={
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 px-1">
                  Productos existentes ({productos.length})
                </span>
              }
            >
              {productos.map((p) => {
                const isSelected = productoIdSeleccionado === Number(p.id);
                return (
                  <CommandItem
                    key={p.id}
                    value={String(p.id)}
                    onSelect={() => handleSelectProducto(Number(p.id))}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer",
                      "data-[selected=true]:bg-primary/10",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    <div className="h-10 w-10 rounded-lg bg-muted border border-border/40 overflow-hidden flex items-center justify-center shrink-0 relative">
                      {p.imagenUrl ? (
                        <Image
                          src={p.imagenUrl}
                          alt={p.nombre}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "font-bold text-sm leading-tight truncate",
                          isSelected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {p.nombre}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {p.categoria?.nombre && (
                          <span className="text-[10px] text-muted-foreground font-medium truncate">
                            {p.categoria.nombre}
                          </span>
                        )}
                        {p.codigoBarra && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded border border-border/40">
                            <Barcode className="h-2.5 w-2.5" />
                            {p.codigoBarra}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-sm font-bold text-primary tabular-nums shrink-0">
                      {formatMoney(Number(p.precioVenta))}
                    </span>

                    {isSelected && (
                      <Check
                        className="h-4 w-4 text-primary shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 bg-muted/10">
            <span className="text-[10px] text-muted-foreground font-medium">
              {productos.length} productos cargados
            </span>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
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
                seleccionar
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
      </DialogContent>
    </Dialog>
  );
}
