import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatMoney } from "@/lib/utils-format";

import { gastosTypography } from "./gastos-typography";

type GastosSummaryCardsProps = {
  totalPagado: number;
  totalPendiente: number;
};

export function GastosSummaryCards({ totalPagado, totalPendiente }: GastosSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className={`${gastosTypography.sectionTitle} text-emerald-600`}>Total Pagado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`${gastosTypography.amount} text-emerald-700`}>{formatMoney(totalPagado)}</div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-600/70 mt-1">Suma de egresos efectivos del periodo</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-orange-500/20 bg-orange-500/5">
        <CardHeader className="pb-2">
          <CardTitle className={`${gastosTypography.sectionTitle} text-orange-600`}>Total Pendiente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`${gastosTypography.amount} text-orange-700`}>{formatMoney(totalPendiente)}</div>
          <p className="text-xs font-bold uppercase tracking-wide text-orange-600/70 mt-1">Pagos futuros y vencimientos proximos</p>
        </CardContent>
      </Card>
    </div>
  );
}
