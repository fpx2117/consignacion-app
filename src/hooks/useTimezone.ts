"use client";

import * as React from "react";
import { apiService } from "@/lib/apiService";

const TZ_DEFAULT = "America/Argentina/Buenos_Aires";

type ConfigPartial = {
  zonaHoraria?: string | null;
};

/**
 * Lee la zona horaria configurada para la sucursal activa.
 * Hace fetch a /api/settings/general una sola vez por montaje.
 */
export function useTimezone() {
  const [tz, setTz] = React.useState<string>(TZ_DEFAULT);

  React.useEffect(() => {
    let cancelled = false;
    apiService
      .getConfiguracionGeneral()
      .then((res) => {
        if (cancelled) return;
        const config = (
          res && typeof res === "object" && "data" in res ? res.data : res
        ) as ConfigPartial | null;
        const value = config?.zonaHoraria ?? TZ_DEFAULT;
        setTz(value || TZ_DEFAULT);
      })
      .catch(() => {
        // silently fallback to default
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (d: string | Date | null | undefined) =>
    d
      ? new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: tz,
        }).format(new Date(d))
      : "—";

  const formatDateTime = (d: string | Date | null | undefined) =>
    d
      ? new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: tz,
        }).format(new Date(d))
      : "—";

  const formatDateOnly = (d: string | Date | null | undefined) =>
    d
      ? new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: tz,
        }).format(new Date(d))
      : "—";

  return { tz, formatDate, formatDateTime, formatDateOnly };
}
