// Tarjetas de estadística y botón de borrado de la vista de productos.
//
// Extraídos de productos-view.tsx (M08) sin cambios de comportamiento.

import * as React from "react";
import { toast } from "sonner";
import { AlertCircle, ChevronRight, Loader2, TrendingUp } from "lucide-react";

import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color?: "default" | "blue" | "emerald" | "orange" | "red";
  onClick?: () => void;
  clickable?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "default",
  trend,
  trendUp,
  onClick,
  clickable,
}: StatCardProps) {
  const colors = {
    default: "bg-primary/5 text-primary",
    blue: "bg-[color:var(--theme-ocean-primary)]/10 text-[color:var(--theme-ocean-primary)]",
    emerald:
      "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]",
    orange:
      "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]",
    red: "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)]",
  };

  return (
    <Card
      className={cn(
        "p-5 border-border/50 shadow-sm bg-card/50 backdrop-blur-sm relative overflow-hidden group hover:bg-card/80 transition-all",
        clickable && "cursor-pointer hover:shadow-md hover:border-primary/40",
      )}
      onClick={clickable ? onClick : undefined}
    >
      {clickable && (
        <div className="absolute top-3 right-3 z-20">
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        </div>
      )}
      <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className={cn("h-16 w-16", colors[color].split(" ")[1])} />
      </div>
      <div className="flex flex-col gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            {label}
          </p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-black tracking-tight text-foreground">
              {value}
            </h3>
          </div>
          {trend && (
            <p
              className={cn(
                "text-[10px] font-bold flex items-center gap-1",
                trendUp
                  ? "text-[color:var(--status-success-strong)]"
                  : "text-[color:var(--status-danger)]",
              )}
            >
              {trendUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
              {trend}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function DeleteButton({
  id,
  nombre,
  onDeleted,
  trigger,
}: {
  id: number;
  nombre: string;
  onDeleted: () => void;
  trigger: React.ReactNode;
}) {
  const [deleting, setDeleting] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiService.deleteProducto(id);
      toast.success("Eliminado correctamente");
      onDeleted();
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {trigger}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="mx-auto bg-[color:var(--status-danger)] dark:bg-[color:var(--status-danger)]/30 p-3 rounded-full w-fit mb-2">
              <AlertCircle className="h-8 w-8 text-[color:var(--status-danger)]" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-center">
              ¿Eliminar producto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-muted-foreground">
              Estás a punto de eliminar{" "}
              <span className="font-bold text-foreground">
                &quot;{nombre}&quot;
              </span>
              . Esta acción es irreversible y afectará los reportes de
              inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:flex-row sm:justify-center pt-2">
            <AlertDialogCancel
              className="h-11 rounded-xl mt-0"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)] font-bold"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sí, eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
