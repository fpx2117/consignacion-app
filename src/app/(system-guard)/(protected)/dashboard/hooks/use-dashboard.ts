/* eslint-disable */
// @ts-nocheck
import * as React from "react";
import type {
  DashboardPeriod, DashboardKpis, DashboardConsignacionesResponse,
  DashboardTopProductos, DashboardTendencia
} from "@/lib/types";
import { useSucursalStore } from "@/store/useSucursalStore";
import {
  fetchDashboardKpis,
  fetchDashboardConsignaciones,
  fetchDashboardTopProductos,
  fetchDashboardTendencia,
} from "../actions/dashboard-actions";

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
        fetchDashboardKpis(period),
        fetchDashboardConsignaciones(5),
        fetchDashboardTopProductos(period, 5),
      ]);

      let trData: DashboardTendencia | null = null;
      if (period !== "all") {
        trData = await fetchDashboardTendencia(period as Exclude<DashboardPeriod, "all">);
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
