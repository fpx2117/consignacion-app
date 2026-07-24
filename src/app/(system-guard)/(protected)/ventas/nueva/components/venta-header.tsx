import { ArrowLeft, Lock, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type VentaHeaderProps = {
  showQuickSaleTag: boolean;
  showCloseShift: boolean;
  onBack: () => void;
  onCloseShift: () => void;
};

export function VentaHeader({
  showQuickSaleTag,
  showCloseShift,
  onBack,
  onCloseShift,
}: VentaHeaderProps) {
  return (
    <header className="shrink-0 h-14 border-b bg-background flex items-center justify-between px-4 z-20 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="-ml-2 text-muted-foreground focus-visible:ring-2"
          onClick={onBack}
          aria-label="Volver a la pantalla anterior"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
            Punto de Venta
          </h1>
          {showQuickSaleTag && (
            <Badge
              variant="outline"
              className="text-[9px] bg-muted/30 text-muted-foreground hidden sm:flex items-center gap-1 border-border/50"
            >
              <Store className="h-3 w-3" aria-hidden="true" /> Venta Rapida
            </Badge>
          )}
        </div>
      </div>

      {showCloseShift && (
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="text-[color:var(--status-danger)] border-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] hover:text-[color:var(--status-danger)] font-semibold text-xs h-8 rounded-lg focus-visible:ring-2"
          onClick={onCloseShift}
          aria-label="Cerrar turno de caja"
        >
          <Lock className="h-3 w-3 mr-1.5" aria-hidden="true" />
          Cerrar Turno
        </Button>
      )}
    </header>
  );
}
