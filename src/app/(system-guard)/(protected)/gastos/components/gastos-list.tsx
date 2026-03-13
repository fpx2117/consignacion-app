import {
  AlertTriangle,
  Calendar,
  Edit2,
  GitFork,
  MoreVertical,
  Receipt,
  Repeat,
  Share2,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney } from "@/lib/utils-format";

import { gastosTypography } from "./gastos-typography";

type Categoria = { nombre?: string };

type GastoItem = {
  id: number;
  monto: number | string;
  motivo: string;
  fecha: string | Date;
  fechaVencimiento?: string | Date | null;
  estado: "PAGADO" | "PENDIENTE";
  esRecurrente?: boolean;
  categoria?: Categoria | null;
  categoriaGastoId?: number;
  cuotaActual?: number | null;
  cuotaTotal?: number | null;
  sucursalId?: number;
  esCompartido?: boolean;
  esVistaCompartida?: boolean;
};

type GastosListProps = {
  gastos: GastoItem[];
  loading: boolean;
  activeSucursalId?: number;
  onShare: (gasto: GastoItem) => void;
  onEdit: (gasto: GastoItem) => void;
  onDelete: (id: number) => void;
};

export function GastosList({
  gastos,
  loading,
  activeSucursalId,
  onShare,
  onEdit,
  onDelete,
}: GastosListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (gastos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Receipt className="h-10 w-10 opacity-20" />
        </div>
        <p className="text-lg font-bold">No hay gastos registrados</p>
        <p className="text-sm mt-1">Los egresos del negocio apareceran aqui</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 px-2 md:px-0">
      {gastos.map((g) => {
        const isOwner = g.sucursalId === activeSucursalId;
        const isOverdue = Boolean(g.fechaVencimiento) && new Date(g.fechaVencimiento as string) < new Date() && g.estado === "PENDIENTE";

        return (
          <div
            key={`${g.id}-${g.esVistaCompartida ? "shared" : "own"}`}
            className={cn(
              "group p-1 rounded-[2rem] transition-all hover:scale-[1.01] active:scale-[0.99]",
              g.estado === "PENDIENTE"
                ? "bg-gradient-to-br from-[color:var(--status-warning)]/20 to-transparent"
                : "bg-gradient-to-br from-[color:var(--status-success-strong)]/20 to-transparent",
            )}
          >
            <div className="bg-card border border-[color:var(--ui-fx-white)]/10 rounded-[1.8rem] p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm group-hover:shadow-xl transition-all">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div
                  className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:rotate-12",
                    g.estado === "PENDIENTE" ? "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]" : "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]",
                  )}
                >
                  {g.esRecurrente ? <Repeat className="h-7 w-7" /> : <Receipt className="h-7 w-7" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className={`${gastosTypography.itemTitle} truncate`}>{g.motivo}</h3>

                    {g.cuotaActual && g.cuotaTotal && (
                      <Badge variant="outline" className="text-[10px] font-semibold border-primary/30 text-primary bg-primary/5 rounded-full px-2">
                        Cuota {g.cuotaActual}/{g.cuotaTotal}
                      </Badge>
                    )}

                    <Badge variant="secondary" className={`${gastosTypography.badge} px-2 py-0.5 rounded-full bg-primary/5 text-primary/70`}>
                      {g.categoria?.nombre}
                    </Badge>

                    {(g.esCompartido || g.esVistaCompartida) && (
                      <Badge variant="outline" className={`${gastosTypography.badge} px-2 py-0.5 rounded-full border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 text-[color:var(--primary)] flex items-center gap-1`}>
                        <GitFork className="h-2.5 w-2.5" /> Compartido
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <span className={`${gastosTypography.meta} flex items-center gap-1.5`}>
                      <Calendar className="h-3 w-3" /> {formatDate(g.fecha)}
                    </span>

                    {g.fechaVencimiento && (
                      <span
                        className={cn(
                          `${gastosTypography.meta} flex items-center gap-1.5`,
                          isOverdue ? "text-destructive" : "text-[color:var(--status-warning)]/80",
                        )}
                      >
                        <AlertTriangle className="h-3 w-3" /> Vence: {formatDate(g.fechaVencimiento)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-[color:var(--ui-fx-white)]/5">
                <div className="text-left sm:text-right">
                  <div className="text-2xl md:text-3xl font-black tracking-tight leading-none mb-1">
                    {formatMoney(Number(g.monto))}
                  </div>
                  {g.esVistaCompartida && (
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[color:var(--primary)]/70 mb-1">Tu parte</p>
                  )}
                  <Badge
                    className={cn(
                      `${gastosTypography.badge} px-3 py-1 rounded-full`,
                      g.estado === "PENDIENTE" ? "bg-[color:var(--status-warning)] text-[color:var(--ui-fx-white)]" : "bg-[color:var(--status-success-strong)] text-[color:var(--ui-fx-white)]",
                    )}
                  >
                    {g.estado}
                  </Badge>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-2xl h-12 w-12 bg-muted/20 hover:bg-primary/10 hover:text-primary transition-all">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-[1.5rem] border-none shadow-2xl p-2 w-56">
                    <DropdownMenuItem
                      onClick={() => onShare(g)}
                      className="gap-3 py-3 rounded-xl font-bold cursor-pointer focus:bg-[color:var(--status-success-strong)]/10 focus:text-[color:var(--status-success-strong)] transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-[color:var(--status-success-strong)]/10 flex items-center justify-center">
                        <Share2 className="h-4 w-4 text-[color:var(--status-success-strong)]" />
                      </div>
                      Compartir Voucher
                    </DropdownMenuItem>

                    {isOwner && (
                      <>
                        <DropdownMenuItem
                          onClick={() => onEdit(g)}
                          className="gap-3 py-3 rounded-xl font-bold cursor-pointer focus:bg-[color:var(--theme-ocean-primary)]/10 focus:text-[color:var(--theme-ocean-primary)] transition-colors"
                        >
                          <div className="h-8 w-8 rounded-lg bg-[color:var(--theme-ocean-primary)]/10 flex items-center justify-center">
                            <Edit2 className="h-4 w-4 text-[color:var(--theme-ocean-primary)]" />
                          </div>
                          Editar Gasto
                        </DropdownMenuItem>

                        <div className="h-px bg-muted my-1 mx-2" />

                        <DropdownMenuItem
                          onClick={() => onDelete(g.id)}
                          className="gap-3 py-3 rounded-xl font-bold cursor-pointer text-destructive focus:bg-destructive/10 transition-colors"
                        >
                          <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <Trash2 className="h-4 w-4" />
                          </div>
                          Eliminar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
