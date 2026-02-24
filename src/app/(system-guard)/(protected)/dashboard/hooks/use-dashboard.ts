import * as React from "react";
import { apiService } from "@/lib/apiService";
import type {
  DashboardPeriod, DashboardKpis, DashboardConsignacionesResponse,
  DashboardTopProductos, DashboardTendencia
} from "@/lib/types";
import { useSucursalStore } from "@/store/useSucursalStore";

export function useDashboard(period: DashboardPeriod) {
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const [data, setData] = React.useState({
    kpis: null as DashboardKpis | null,
    consig: null as DashboardConsignacionesResponse | null,
    top: null as DashboardTopProductos | null,
    trend: null as DashboardTendencia | null,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [k, c, t] = await Promise.all([
        apiService.getDashboardKpis(period),
        apiService.getDashboardConsignaciones(8),
        apiService.getDashboardTopProductos(period, 8),
      ]);

      let trData = null;
      if (period !== "all") {
        const tr = await apiService.getDashboardTendencia(period);
        trData = tr;
      }

      setData({ kpis: k, consig: c, top: t, trend: trData });
    } catch (e: any) {
      setError(e?.message ?? "Error cargando dashboard");
    } finally {
      setLoading(false);
    }
  }, [period]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll, activeSucursalId]);

  return { ...data, loading, error, refresh: loadAll };
}