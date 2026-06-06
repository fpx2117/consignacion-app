"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OnlineStoreSettings } from "@/lib/types";
import { defaultOnlineStoreSettings } from "@/lib/types";

type UseOnlineStoreSettingsReturn = {
  settings: OnlineStoreSettings;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateSettings: (partial: Partial<OnlineStoreSettings>) => void;
};

/**
 * Hook para consumir la configuración visual de la tienda online.
 * Obtiene la configuración real del backend y la mezcla con defaults seguros.
 * Si la API falla o la configuración no existe, usa los defaults.
 */
export function useOnlineStoreSettings(
  sucursalId: number = 1
): UseOnlineStoreSettingsReturn {
  const [rawConfig, setRawConfig] = useState<Partial<OnlineStoreSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings?sucursalId=${sucursalId}`);
      if (res.ok) {
        const json = await res.json();
        const onlineStoreConfig = json?.data?.onlineStoreConfig;
        if (onlineStoreConfig && typeof onlineStoreConfig === "object") {
          setRawConfig(onlineStoreConfig as Partial<OnlineStoreSettings>);
          return;
        }
      }
      // Sin configuración guardada → defaults
      setRawConfig(null);
    } catch (e) {
      console.warn("useOnlineStoreSettings: fallback a defaults", e);
      setRawConfig(null);
    } finally {
      setLoading(false);
    }
  }, [sucursalId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Mezclar configuración real con defaults — el orden importa:
  // defaults primero, luego los valores reales los sobrescriben
  const settings = useMemo((): OnlineStoreSettings => {
    if (!rawConfig) return defaultOnlineStoreSettings;

    return {
      storeName: rawConfig.storeName ?? defaultOnlineStoreSettings.storeName,
      storeLogoUrl: rawConfig.storeLogoUrl ?? defaultOnlineStoreSettings.storeLogoUrl,
      storeBannerUrl: rawConfig.storeBannerUrl ?? defaultOnlineStoreSettings.storeBannerUrl,
      description: rawConfig.description ?? defaultOnlineStoreSettings.description,
      openingHours: rawConfig.openingHours ?? defaultOnlineStoreSettings.openingHours,
      addressText: rawConfig.addressText ?? defaultOnlineStoreSettings.addressText,
      theme: {
        ...defaultOnlineStoreSettings.theme,
        ...(rawConfig.theme || {}),
      },
      catalog: {
        ...defaultOnlineStoreSettings.catalog,
        ...(rawConfig.catalog || {}),
      },
      promotions: {
        ...defaultOnlineStoreSettings.promotions,
        ...(rawConfig.promotions || {}),
        items: rawConfig.promotions?.items ?? defaultOnlineStoreSettings.promotions.items,
      },
      cart: {
        ...defaultOnlineStoreSettings.cart,
        ...(rawConfig.cart || {}),
        messageTemplate: {
          ...defaultOnlineStoreSettings.cart.messageTemplate,
          ...(rawConfig.cart?.messageTemplate || {}),
        },
      },
      responsive: {
        ...defaultOnlineStoreSettings.responsive,
        ...(rawConfig.responsive || {}),
      },
    };
  }, [rawConfig]);

  const updateSettings = useCallback((partial: Partial<OnlineStoreSettings>) => {
    setRawConfig((prev) => ({
      ...prev,
      ...partial,
    }));
  }, []);

  return { settings, loading, error, refetch: fetchSettings, updateSettings };
}
