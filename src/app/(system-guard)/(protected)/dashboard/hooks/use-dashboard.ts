import * as React from "react";
import type {
  DashboardPeriod,
  DashboardDateRange,
  DashboardKpis,
  DashboardConsignacionesResponse,
  DashboardTopProductos,
  DashboardTendencia,
} from "@/lib/types";
import { useSucursalStore } from "@/store/useSucursalStore";
import {
  fetchDashboardKpis,
  fetchDashboardConsignaciones,
  fetchDashboardTopProductos,
  fetchDashboardTendencia,
} from "../actions/dashboard-actions";

const POLL_INTERVAL_MS = 15_000;

export function useDashboard(
  period: DashboardPeriod,
  range?: DashboardDateRange | null,
) {
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const [data, setData] = React.useState({
    kpis: null as DashboardKpis | null,
    consig: null as DashboardConsignacionesResponse | null,
    top: null as DashboardTopProductos | null,
    trend: null as DashboardTendencia | null,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const requestIdRef = React.useRef(0);

  // Carga inicial y cambios de periodo/sucursal: muestra skeleton (loading=true)
  const loadAll = React.useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [k, c, t] = await Promise.all([
        fetchDashboardKpis(period, activeSucursalId, range),
        fetchDashboardConsignaciones(5, activeSucursalId),
        fetchDashboardTopProductos(period, 5, activeSucursalId, range),
      ]);

      let trData: DashboardTendencia | null = null;
      if (period !== "all") {
        trData = await fetchDashboardTendencia(
          period as Exclude<DashboardPeriod, "all">,
          activeSucursalId,
          range,
        );
      }

      if (requestId === requestIdRef.current) {
        setData({ kpis: k, consig: c, top: t, trend: trData });
      }
    } catch (e: unknown) {
      if (requestId === requestIdRef.current) {
        setError(e instanceof Error ? e.message : "Error cargando dashboard");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [period, range, activeSucursalId]);

  // Refresco silencioso: no activa skeleton, actualiza datos en background
  const silentRefresh = React.useCallback(async () => {
    const requestId = requestIdRef.current;
    try {
      const [k, c, t] = await Promise.all([
        fetchDashboardKpis(period, activeSucursalId, range),
        fetchDashboardConsignaciones(5, activeSucursalId),
        fetchDashboardTopProductos(period, 5, activeSucursalId, range),
      ]);

      let trData: DashboardTendencia | null = null;
      if (period !== "all") {
        trData = await fetchDashboardTendencia(
          period as Exclude<DashboardPeriod, "all">,
          activeSucursalId,
          range,
        );
      }

      if (requestId === requestIdRef.current) {
        setData({ kpis: k, consig: c, top: t, trend: trData });
      }
    } catch {
      // En polling silencioso ignoramos errores transitorios
    }
  }, [period, range, activeSucursalId]);

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
