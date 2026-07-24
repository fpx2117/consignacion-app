"use client";

import * as React from "react";
import type { OnlineStoreSettings } from "@/lib/types";
import { getStoreCSSVariables } from "@/lib/storefront/store-theme-utils";

type StoreThemeWrapperProps = {
  settings: OnlineStoreSettings;
  children: React.ReactNode;
  className?: string;
};

/**
 * Wrapper que inyecta CSS variables de OnlineStoreSettings en el DOM.
 * Usa el atributo data-store-config="true" para activar los overrides en storefront.css.
 */
export function StoreThemeWrapper({
  settings,
  children,
  className,
}: StoreThemeWrapperProps) {
  const cssVars = React.useMemo(
    () => getStoreCSSVariables(settings.theme),
    [settings.theme],
  );

  return (
    <div
      data-store-config="true"
      style={
        {
          "--store-primary-override": cssVars["--store-primary"],
          "--store-primary-rgb-override":
            cssVars["--store-primary-rgb"] ??
            hexToRgbStr(cssVars["--store-primary"]),
          "--store-secondary-override": cssVars["--store-secondary"],
          "--store-background-override": cssVars["--store-background"],
          "--store-surface-override": cssVars["--store-surface"],
          "--store-surface-rgb-override":
            cssVars["--store-surface-rgb"] ??
            hexToRgbStr(cssVars["--store-surface"]),
          "--store-text-override": cssVars["--store-text"],
          "--store-muted-override": cssVars["--store-muted"],
          "--store-whatsapp-override": cssVars["--store-whatsapp"],
          "--store-whatsapp-rgb-override":
            cssVars["--store-whatsapp-rgb"] ??
            hexToRgbStr(cssVars["--store-whatsapp"]),
        } as React.CSSProperties
      }
      className={className}
    >
      {children}
    </div>
  );
}

function hexToRgbStr(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0, 0, 0";
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
