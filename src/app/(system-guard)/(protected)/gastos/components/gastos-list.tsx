import * as React from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Edit2,
  FolderKanban,
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
import { useTimezone } from "@/hooks/useTimezone";
import { nowAR } from "@/lib/utils-date";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/utils-format";

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
  recurrenciaId?: string | null;
  sucursalId?: number;
  esCompartido?: boolean;
  esVistaCompartida?: boolean;
};

type GastosListProps = {
  gastos: GastoItem[];
  loading: boolean;
  activeSucursalId?: number;
  onShare: (gasto: GastoItem) => void;
  onToggleEstado: (gasto: GastoItem) => void;
  onEdit: (gasto: GastoItem) => void;
  onDelete: (id: number) => void;
};

type GastoEntry =
  | { type: "single"; gasto: GastoItem }
  | { type: "group"; recurrenciaId: string; gastos: GastoItem[] };

export function GastosList({
  gastos,
  loading,
  activeSucursalId,
  onShare,
  onToggleEstado,
  onEdit,
  onDelete,
}: GastosListProps) {
  const { tz, formatDateTime } = useTimezone();
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  const entries = React.useMemo<GastoEntry[]>(() => {
    const grouped = new Map<string, GastoItem[]>();
    const list: GastoEntry[] = [];

    for (const gasto of gastos) {
      const shouldGroup = Boolean(
        gasto.recurrenciaId && gasto.esRecurrente && (gasto.cuotaTotal ?? 0) > 1,
      );

      if (!shouldGroup || !gasto.recurrenciaId) {
        list.push({ type: "single", gasto });
        continue;
      }

      const current = grouped.get(gasto.recurrenciaId) ?? [];
      current.push(gasto);
      grouped.set(gasto.recurrenciaId, current);
    }

    for (const [recurrenciaId, recurringGastos] of grouped) {
      recurringGastos.sort((a, b) => {
        const cuotaA = a.cuotaActual ?? 0;
        const cuotaB = b.cuotaActual ?? 0;
        return cuotaA - cuotaB;
      });

      list.push({ type: "group", recurrenciaId, gastos: recurringGastos });
    }

    return list.sort((a, b) => {
      const dateA = a.type === "single" ? a.gasto.fecha : a.gastos[0]?.fecha;
      const dateB = b.type === "single" ? b.gasto.fecha : b.gastos[0]?.fecha;

      return new Date(dateB ?? 0).getTime() - new Date(dateA ?? 0).getTime();
    });
  }, [gastos]);

  const toggleGroup = (recurrenciaId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [recurrenciaId]: !prev[recurrenciaId],
    }));
  };

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
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
          <Receipt className="h-10 w-10 opacity-20" />
        </div>
        <p className="text-lg font-bold">No hay gastos registrados</p>
        <p className="mt-1 text-sm">Los egresos del negocio apareceran aqui</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 px-2 md:px-0">
      {entries.map((entry) => {
        if (entry.type === "single") {
          return renderGastoCard({
            gasto: entry.gasto,
            activeSucursalId,
            formatDateTime,
            onDelete,
            onEdit,
            onShare,
            onToggleEstado,
            tz,
          });
        }

        const first = entry.gastos[0];
        const paidCount = entry.gastos.filter((g) => g.estado === "PAGADO").length;
        const pendingItems = entry.gastos.filter((g) => g.estado === "PENDIENTE");
        const nextPending = pendingItems[0] ?? null;
        const pendingTotal = pendingItems.reduce((acc, gasto) => acc + Number(gasto.monto), 0);
        const expanded = Boolean(expandedGroups[entry.recurrenciaId]);

        return (
          <div
            key={`group-${entry.recurrenciaId}`}
            className="rounded-[2rem] border border-[color:var(--ui-fx-white)]/10 bg-card/70 p-3 md:p-4"
          >
            <button
              type="button"
              onClick={() => toggleGroup(entry.recurrenciaId)}
              className="flex w-full flex-col gap-4 rounded-[1.6rem] border border-[color:var(--primary)]/15 bg-[color:var(--primary)]/5 p-4 text-left transition-colors hover:bg-[color:var(--primary)]/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--primary)]/12 text-[color:var(--primary)] shadow-inner">
                    <FolderKanban className="h-7 w-7" />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className={`${gastosTypography.itemTitle} truncate`}>{first.motivo}</h3>
                      <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-2 text-[10px] font-semibold text-primary">
                        {paidCount}/{entry.gastos.length} cuotas pagadas
                      </Badge>
                      <Badge variant="secondary" className={`${gastosTypography.badge} rounded-full bg-primary/5 px-2 py-0.5 text-primary/70`}>
                        {first.categoria?.nombre}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-1 text-xs font-bold text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <span className="flex items-center gap-1.5">
                        <Repeat className="h-3.5 w-3.5" /> {entry.gastos.length} cuotas materializadas
                      </span>
                      {nextPending && (
                        <span className="flex items-center gap-1.5 text-[color:var(--status-warning)]/90">
                          <AlertTriangle className="h-3.5 w-3.5" /> Proxima cuota: {formatDateTime(nextPending.fechaVencimiento ?? nextPending.fecha)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-black tracking-tight text-foreground md:text-2xl">
                      {formatMoney(Number(first.monto))}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--status-warning)]/80">
                      Pendiente: {formatMoney(pendingTotal)}
                    </p>
                  </div>
                  {expanded ? (
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>

            {expanded && (
              <div className="mt-3 grid gap-3 pl-0 md:pl-4">
                {entry.gastos.map((gasto) =>
                  renderGastoCard({
                    gasto,
                    activeSucursalId,
                    compact: true,
                    formatDateTime,
                    onDelete,
                    onEdit,
                    onShare,
                    onToggleEstado,
                    tz,
                  }),
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type RenderGastoCardArgs = {
  gasto: GastoItem;
  activeSucursalId?: number;
  compact?: boolean;
  formatDateTime: (value: string | Date | null | undefined) => string;
  onDelete: (id: number) => void;
  onEdit: (gasto: GastoItem) => void;
  onShare: (gasto: GastoItem) => void;
  onToggleEstado: (gasto: GastoItem) => void;
  tz: string;
};

function renderGastoCard({
  gasto,
  activeSucursalId,
  compact = false,
  formatDateTime,
  onDelete,
  onEdit,
  onShare,
  onToggleEstado,
  tz,
}: RenderGastoCardArgs) {
  const isOwner = gasto.sucursalId === activeSucursalId;
  const isOverdue =
    Boolean(gasto.fechaVencimiento) &&
    new Date(gasto.fechaVencimiento as string) < nowAR(tz) &&
    gasto.estado === "PENDIENTE";

  return (
    <div
      key={`${gasto.id}-${gasto.esVistaCompartida ? "shared" : "own"}`}
      className={cn(
        "group rounded-[2rem] p-1 transition-all hover:scale-[1.01] active:scale-[0.99]",
        compact && "ml-0 md:ml-3",
        gasto.estado === "PENDIENTE"
          ? "bg-gradient-to-br from-[color:var(--status-warning)]/20 to-transparent"
          : "bg-gradient-to-br from-[color:var(--status-success-strong)]/20 to-transparent",
      )}
    >
      <div className="flex flex-col items-start justify-between gap-6 rounded-[1.8rem] border border-[color:var(--ui-fx-white)]/10 bg-card p-4 shadow-sm transition-all group-hover:shadow-xl md:p-6 sm:flex-row sm:items-center">
        <div className="flex w-full items-center gap-4 sm:w-auto">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner transition-transform group-hover:rotate-12",
              gasto.estado === "PENDIENTE"
                ? "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]"
                : "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]",
            )}
          >
            {gasto.esRecurrente ? <Repeat className="h-7 w-7" /> : <Receipt className="h-7 w-7" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className={`${gastosTypography.itemTitle} truncate`}>{gasto.motivo}</h3>

              {gasto.cuotaActual && gasto.cuotaTotal && (
                <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-2 text-[10px] font-semibold text-primary">
                  Cuota {gasto.cuotaActual}/{gasto.cuotaTotal}
                </Badge>
              )}

              <Badge variant="secondary" className={`${gastosTypography.badge} rounded-full bg-primary/5 px-2 py-0.5 text-primary/70`}>
                {gasto.categoria?.nombre}
              </Badge>

              {(gasto.esCompartido || gasto.esVistaCompartida) && (
                <Badge variant="outline" className={`${gastosTypography.badge} flex items-center gap-1 rounded-full border-[color:var(--primary)]/40 bg-[color:var(--primary)]/10 px-2 py-0.5 text-[color:var(--primary)]`}>
                  <GitFork className="h-2.5 w-2.5" /> Compartido
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              <span className={`${gastosTypography.meta} flex items-center gap-1.5`}>
                <Calendar className="h-3 w-3" /> {formatDateTime(gasto.fecha)}
              </span>

              {gasto.fechaVencimiento && (
                <span
                  className={cn(
                    `${gastosTypography.meta} flex items-center gap-1.5`,
                    isOverdue ? "text-destructive" : "text-[color:var(--status-warning)]/80",
                  )}
                >
                  <AlertTriangle className="h-3 w-3" /> Vence: {formatDateTime(gasto.fechaVencimiento)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-6 border-t border-[color:var(--ui-fx-white)]/5 pt-4 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
          <div className="text-left sm:text-right">
            <div className="mb-1 text-2xl font-black leading-none tracking-tight md:text-3xl">
              {formatMoney(Number(gasto.monto))}
            </div>
            {gasto.esVistaCompartida && (
              <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[color:var(--primary)]/70">
                Tu parte
              </p>
            )}
            <Badge
              className={cn(
                `${gastosTypography.badge} rounded-full px-3 py-1`,
                gasto.estado === "PENDIENTE"
                  ? "bg-[color:var(--status-warning)] text-[color:var(--ui-fx-white)]"
                  : "bg-[color:var(--status-success-strong)] text-[color:var(--ui-fx-white)]",
              )}
            >
              {gasto.estado}
            </Badge>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-muted/20 transition-all hover:bg-primary/10 hover:text-primary">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-[1.5rem] border-none p-2 shadow-2xl">
              <DropdownMenuItem
                onClick={() => onShare(gasto)}
                className="cursor-pointer gap-3 rounded-xl py-3 font-bold transition-colors focus:bg-[color:var(--status-success-strong)]/10 focus:text-[color:var(--status-success-strong)]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--status-success-strong)]/10">
                  <Share2 className="h-4 w-4 text-[color:var(--status-success-strong)]" />
                </div>
                Compartir Voucher
              </DropdownMenuItem>

              {isOwner && (
                <>
                  <DropdownMenuItem
                    onClick={() => onToggleEstado(gasto)}
                    className="cursor-pointer gap-3 rounded-xl py-3 font-bold transition-colors focus:bg-[color:var(--status-warning)]/10 focus:text-[color:var(--status-warning)]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--status-warning)]/10">
                      {gasto.estado === "PAGADO" ? (
                        <CircleDashed className="h-4 w-4 text-[color:var(--status-warning)]" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-[color:var(--status-success-strong)]" />
                      )}
                    </div>
                    {gasto.estado === "PAGADO" ? "Marcar como Pendiente" : "Marcar como Pagado"}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => onEdit(gasto)}
                    className="cursor-pointer gap-3 rounded-xl py-3 font-bold transition-colors focus:bg-[color:var(--theme-ocean-primary)]/10 focus:text-[color:var(--theme-ocean-primary)]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--theme-ocean-primary)]/10">
                      <Edit2 className="h-4 w-4 text-[color:var(--theme-ocean-primary)]" />
                    </div>
                    Editar Gasto
                  </DropdownMenuItem>

                  <div className="mx-2 my-1 h-px bg-muted" />

                  <DropdownMenuItem
                    onClick={() => onDelete(gasto.id)}
                    className="cursor-pointer gap-3 rounded-xl py-3 font-bold text-destructive transition-colors focus:bg-destructive/10"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
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
}
