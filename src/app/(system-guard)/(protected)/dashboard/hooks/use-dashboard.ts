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

const POLL_INTERVAL_MS = 15_000;

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

  // Carga inicial y cambios de periodo/sucursal: muestra skeleton (loading=true)
  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [k, c, t] = await Promise.all([
        fetchDashboardKpis(period, activeSucursalId),
        fetchDashboardConsignaciones(5, activeSucursalId),
        fetchDashboardTopProductos(period, 5, activeSucursalId),
      ]);

      let trData: DashboardTendencia | null = null;
      if (period !== "all") {
        trData = await fetchDashboardTendencia(period as Exclude<DashboardPeriod, "all">, activeSucursalId);
      }

      setData({ kpis: k, consig: c, top: t, trend: trData });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando dashboard");
    } finally {
      setLoading(false);
    }
  }, [period, activeSucursalId]);

  // Refresco silencioso: no activa skeleton, actualiza datos en background
  const silentRefresh = React.useCallback(async () => {
    try {
      const [k, c, t] = await Promise.all([
        fetchDashboardKpis(period, activeSucursalId),
        fetchDashboardConsignaciones(5, activeSucursalId),
        fetchDashboardTopProductos(period, 5, activeSucursalId),
      ]);

      let trData: DashboardTendencia | null = null;
      if (period !== "all") {
        trData = await fetchDashboardTendencia(period as Exclude<DashboardPeriod, "all">, activeSucursalId);
      }

      setData({ kpis: k, consig: c, top: t, trend: trData });
    } catch {
      // En polling silencioso ignoramos errores transitorios
    }
  }, [period, activeSucursalId]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Polling cada 15s — refresco silencioso sin parpadeo de skeleton
  React.useEffect(() => {
    const id = setInterval(silentRefresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [silentRefresh]);

  return { ...data, loading, error, refresh: loadAll };
}
