"use client";

import * as React from "react";
import { apiService } from "@/lib/apiService";
import { TECHNICAL_FALLBACK_TZ } from "@/lib/timezone/timezone-constants";
import type { TimezoneSource, Usuario } from "@/lib/types";
import {
  formatDate,
  formatDateTime,
  formatDateWithOptions,
} from "@/lib/date-format/utils-format";

type TimezoneSession = Pick<
  Usuario,
  | "rol"
  | "zonaHoraria"
  | "zonaHorariaSucursal"
  | "zonaHorariaResuelta"
  | "timezoneSource"
>;

export const DEFAULT_TIMEZONE_SESSION: TimezoneSession = {
  rol: "EMPLEADO",
  zonaHoraria: null,
  zonaHorariaSucursal: null,
  zonaHorariaResuelta: TECHNICAL_FALLBACK_TZ,
  timezoneSource: "fallback",
};

export type TimezoneSessionStore = {
  cachedSession: TimezoneSession | null;
  pendingSessionRequest: Promise<TimezoneSession> | null;
};

export function createTimezoneSessionStore(): TimezoneSessionStore {
  return {
    cachedSession: null,
    pendingSessionRequest: null,
  };
}

const sessionStore = createTimezoneSessionStore();

function normalizeTimezoneSession(
  session: Partial<TimezoneSession>,
): TimezoneSession {
  return {
    rol: session.rol ?? "EMPLEADO",
    zonaHoraria: session.zonaHoraria ?? null,
    zonaHorariaSucursal: session.zonaHorariaSucursal ?? null,
    zonaHorariaResuelta: session.zonaHorariaResuelta ?? TECHNICAL_FALLBACK_TZ,
    timezoneSource: session.timezoneSource ?? "fallback",
  };
}

export async function fetchTimezoneSessionWithApi(
  getSession: () => Promise<TimezoneSession>,
  store: TimezoneSessionStore,
  force = false,
): Promise<TimezoneSession> {
  if (!force && store.cachedSession) {
    return store.cachedSession;
  }

  if (!force && store.pendingSessionRequest) {
    return store.pendingSessionRequest;
  }

  store.pendingSessionRequest = getSession()
    .then((session) => {
      store.cachedSession = normalizeTimezoneSession(session);
      return store.cachedSession;
    })
    .catch(() => store.cachedSession ?? DEFAULT_TIMEZONE_SESSION)
    .finally(() => {
      store.pendingSessionRequest = null;
    });

  return store.pendingSessionRequest;
}

async function fetchTimezoneSession(force = false): Promise<TimezoneSession> {
  return fetchTimezoneSessionWithApi(
    () => apiService.me(),
    sessionStore,
    force,
  );
}

export function resetTimezoneSessionCache() {
  sessionStore.cachedSession = null;
  sessionStore.pendingSessionRequest = null;
}

export function useTimezone() {
  const [session, setSession] = React.useState<TimezoneSession>(
    sessionStore.cachedSession ?? DEFAULT_TIMEZONE_SESSION,
  );
  const [isLoading, setIsLoading] = React.useState(!sessionStore.cachedSession);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    const nextSession = await fetchTimezoneSession(true);
    setSession(nextSession);
    setIsLoading(false);
    return nextSession;
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    fetchTimezoneSession()
      .then((nextSession) => {
        if (!cancelled) {
          setSession(nextSession);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(DEFAULT_TIMEZONE_SESSION);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tz = session.zonaHorariaResuelta ?? TECHNICAL_FALLBACK_TZ;
  const source = (session.timezoneSource ?? "fallback") as TimezoneSource;

  const formatDateOnly = React.useCallback(
    (value: string | Date | null | undefined) =>
      formatDateWithOptions(
        value,
        {
          day: "2-digit",
          month: "long",
          year: "numeric",
        },
        tz,
        "—",
      ),
    [tz],
  );

  const formatWithOptions = React.useCallback(
    (
      value: string | Date | null | undefined,
      options: Intl.DateTimeFormatOptions,
      emptyValue = "—",
    ) => formatDateWithOptions(value, options, tz, emptyValue),
    [tz],
  );

  return {
    tz,
    source,
    role: session.rol,
    userTimezone: session.zonaHoraria ?? null,
    branchTimezone: session.zonaHorariaSucursal ?? null,
    resolvedTimezone: tz,
    isLoading,
    refresh,
    formatDate: React.useCallback(
      (value: string | Date | null | undefined) => formatDate(value, tz),
      [tz],
    ),
    formatDateTime: React.useCallback(
      (value: string | Date | null | undefined) => formatDateTime(value, tz),
      [tz],
    ),
    formatDateOnly,
    formatWithOptions,
  };
}
