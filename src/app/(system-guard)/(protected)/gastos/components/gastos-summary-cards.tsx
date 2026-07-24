import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatMoney } from "@/lib/date-format/utils-format";

import { gastosTypography } from "./gastos-typography";

type GastosSummaryCardsProps = {
  totalPagado: number;
  totalPendiente: number;
};

export function GastosSummaryCards({
  totalPagado,
  totalPendiente,
}: GastosSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="rounded-2xl border-[color:var(--status-success-strong)]/20 bg-[color:var(--status-success-strong)]/5">
        <CardHeader className="pb-2">
          <CardTitle
            className={`${gastosTypography.sectionTitle} text-[color:var(--status-success-strong)]`}
          >
            Total Pagado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`${gastosTypography.amount} text-[color:var(--status-success-strong)]`}
          >
            {formatMoney(totalPagado)}
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--status-success-strong)]/70 mt-1">
            Suma de egresos efectivos del periodo
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-[color:var(--status-warning)]/20 bg-[color:var(--status-warning)]/5">
        <CardHeader className="pb-2">
          <CardTitle
            className={`${gastosTypography.sectionTitle} text-[color:var(--status-warning)]`}
          >
            Total Pendiente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`${gastosTypography.amount} text-[color:var(--status-warning)]`}
          >
            {formatMoney(totalPendiente)}
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--status-warning)]/70 mt-1">
            Pagos futuros y vencimientos proximos
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
