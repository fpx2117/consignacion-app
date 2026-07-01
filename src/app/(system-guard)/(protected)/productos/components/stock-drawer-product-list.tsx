import { ArrowRightLeft, Package } from "lucide-react";

import type { Producto } from "@/lib/types";
import { formatMoney } from "@/lib/date-format/utils-format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { AjustarStockDialog } from "./ajustar-stock-dialog";

export type ProductoStockAlertItem = Producto & {
  subcategoria?: {
    nombre?: string | null;
  } | null;
};

interface StockDrawerProductListProps {
  productos: ProductoStockAlertItem[];
  title: string;
  description: string;
  emptyMessage: string;
  variant: "low" | "out";
  onStockUpdated: () => void;
}

const drawerStyles = {
  out: {
    iconWrapper: "bg-red-100 dark:bg-red-950/70",
    item: "bg-red-50 dark:bg-red-950/50 border-red-100 dark:border-red-900/60",
    stockBadge: "bg-red-100 dark:bg-red-900/70 text-red-600 dark:text-red-400",
    actionButton: "border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40",
  },
  low: {
    iconWrapper: "bg-orange-100 dark:bg-orange-950/70",
    item: "bg-orange-50 dark:bg-orange-950/50 border-orange-100 dark:border-orange-900/60",
    stockBadge: "bg-orange-100 dark:bg-orange-900/70 text-orange-600 dark:text-orange-400",
    actionButton: "border-orange-200 dark:border-orange-800 text-orange-500 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/40",
  },
} as const;

export function StockDrawerProductList({
  productos,
  title,
  description,
  emptyMessage,
  variant,
  onStockUpdated,
}: StockDrawerProductListProps) {
  const styles = drawerStyles[variant];

  return (
    <>
      <SheetHeader className="flex-shrink-0 p-5 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl flex-shrink-0", styles.iconWrapper)}>
            <Package className={cn("h-5 w-5", variant === "out" ? "text-red-500" : "text-orange-500")} />
          </div>
          <div className="min-w-0">
            <SheetTitle className="text-base font-black leading-tight">{title}</SheetTitle>
            <SheetDescription className="text-xs mt-0.5">{description}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-2 pb-8">
          {productos.length > 0 ? (
            productos.map((producto) => (
              <div
                key={producto.id}
                className={cn("flex items-start gap-3 p-3 rounded-xl border transition-colors", styles.item)}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black mt-0.5",
                    styles.stockBadge,
                  )}
                >
                  {producto.stockDisponibleUnits}
                </div>

                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-sm font-semibold text-foreground leading-snug break-words">{producto.nombre}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {producto.categoria?.nombre ?? "Sin categoria"}
                    {variant === "low" && producto.stockMinUnits > 0 && (
                      <span className="ml-1.5 text-orange-500 font-medium">· min. {producto.stockMinUnits}</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-black text-foreground">{formatMoney(Number(producto.precioVenta))}</span>
                    {producto.codigoBarra && (
                      <span className="text-[10px] text-muted-foreground/50 font-mono truncate">
                        {producto.codigoBarra}
                      </span>
                    )}
                  </div>
                </div>

                <AjustarStockDialog
                  producto={producto as Producto}
                  onUpdated={onStockUpdated}
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn("flex-shrink-0 h-8 w-8 p-0 rounded-lg border", styles.actionButton)}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Package className="h-12 w-12 opacity-20" />
              <p className="text-sm font-medium text-center">{emptyMessage}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
