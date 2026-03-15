import { BadgePercent, Barcode, ChevronsUpDown, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DescuentoNivel } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ProductoConStock } from "../types";
import { formatCurrency } from "../utils";

type ProductSelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productoId: number | "";
  productos: ProductoConStock[];
  loading: boolean;
  onSelectProduct: (productId: number) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
};

export function ProductSelector({
  open,
  onOpenChange,
  productoId,
  productos,
  loading,
  onSelectProduct,
  triggerRef,
}: ProductSelectorProps) {
  const selectedProduct = productoId ? productos.find((product) => product.id === productoId) : null;

  return (
    <section className="flex-1 min-w-0" aria-label="Seleccion de producto">
      <label htmlFor="selector-producto" className="sr-only">
        Buscar y seleccionar producto
      </label>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            id="selector-producto"
            variant="outline"
            role="combobox"
            type="button"
            aria-label="Escanear o buscar producto"
            className={cn(
              "w-full h-10 text-sm shadow-sm relative text-left pl-9 sm:pl-10 rounded-xl transition-all focus-visible:ring-2",
              !productoId && "text-muted-foreground border-dashed border-border/60",
            )}
            disabled={loading}
          >
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
              <Barcode className="h-4 w-4 text-primary animate-pulse" aria-hidden="true" />
            </div>
            {/* Badge tecla F1 */}
            <span className="hidden md:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center justify-center h-5 px-1.5 rounded border border-border bg-muted text-muted-foreground text-[9px] font-black font-mono tracking-tight select-none">
              F1
            </span>
            <div className="flex items-center w-full overflow-hidden pr-10 md:pr-9">
              <span className="truncate text-xs sm:text-sm">
                {selectedProduct ? selectedProduct.nombre : "Escanear o buscar producto..."}
              </span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50 block md:hidden" aria-hidden="true" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[85vw] md:w-[400px] p-0 rounded-xl" align="start">
          <Command
            filter={(value, search) => {
              const product = productos.find((item) => item.nombre === value);
              if (!product) {
                return 0;
              }
              const normalizedSearch = search.toLowerCase();
              const matchName = product.nombre.toLowerCase().includes(normalizedSearch);
              const matchCode = product.codigoBarra?.toLowerCase().includes(normalizedSearch);
              return matchName || matchCode ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Nombre o codigo..." className="h-12" />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No se encontro el producto.</CommandEmpty>
              <CommandGroup>
                {productos.map((product) => {
                  const stock = product.stockDisponibleUnits ?? 0;
                  const outOfStock = stock <= 0;
                  const discountLevels = Array.isArray(product.subcategoria?.descuentos)
                    ? (product.subcategoria?.descuentos as DescuentoNivel[])
                    : [];

                  return (
                    <CommandItem
                      key={product.id}
                      value={product.nombre}
                      disabled={outOfStock}
                      onSelect={() => onSelectProduct(product.id)}
                      className={cn("flex justify-between py-3 cursor-pointer", outOfStock && "opacity-50")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted border border-border/40 overflow-hidden flex items-center justify-center shrink-0">
                          {product.imagenUrl ? (
                            <Image
                              src={product.imagenUrl}
                              alt={product.nombre}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground/30" aria-hidden="true" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm leading-none truncate">{product.nombre}</span>
                          <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground font-bold">
                            {product.codigoBarra && (
                              <span className="font-mono bg-muted px-1 rounded flex items-center gap-1 border border-border/40">
                                <Barcode className="h-3 w-3" aria-hidden="true" /> {product.codigoBarra}
                              </span>
                            )}
                            <span>{outOfStock ? "AGOTADO" : `Disp: ${stock}`}</span>
                            {discountLevels.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)] px-1 rounded border border-[color:var(--status-success-strong)]">
                                <BadgePercent className="h-3 w-3" aria-hidden="true" /> {discountLevels.length} desc.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={outOfStock ? "destructive" : "secondary"}>{formatCurrency(product.precioVenta)}</Badge>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

    </section>
  );
}
