// src/lib/store-theme-utils.ts
// Helpers visuales que traducen valores de OnlineStoreSettings a clases Tailwind.

import type {
  OnlineStoreBorderRadius,
  OnlineStoreShadow,
  OnlineStoreCardStyle,
  OnlineStoreButtonStyle,
  OnlineStoreProductLayout,
  OnlineStoreDesktopLayout,
} from "@/lib/types";

// ============================================================
// BORDER RADIUS
// ============================================================

export function getRadiusClass(radius: OnlineStoreBorderRadius): string {
  const map: Record<OnlineStoreBorderRadius, string> = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
  };
  return map[radius] || "rounded-2xl";
}

export function getRadiusTopClass(radius: OnlineStoreBorderRadius): string {
  const map: Record<OnlineStoreBorderRadius, string> = {
    sm: "rounded-t-sm",
    md: "rounded-t-md",
    lg: "rounded-t-lg",
    xl: "rounded-t-xl",
    "2xl": "rounded-t-2xl",
  };
  return map[radius] || "rounded-t-2xl";
}

// ============================================================
// SHADOW
// ============================================================

export function getShadowClass(shadow: OnlineStoreShadow): string {
  const map: Record<OnlineStoreShadow, string> = {
    none: "shadow-none",
    soft: "shadow-sm",
    medium: "shadow-md",
    strong: "shadow-lg",
  };
  return map[shadow] || "shadow-sm";
}

// ============================================================
// CARD STYLE
// ============================================================

export function getCardStyleClass(cardStyle: OnlineStoreCardStyle): string {
  const map: Record<OnlineStoreCardStyle, string> = {
    minimal: "border-0 shadow-none bg-[var(--store-surface)]",
    elevated: "border-0 shadow-md bg-[var(--store-surface)]",
    bordered: "border border-gray-200 bg-[var(--store-surface)]",
  };
  return map[cardStyle] || map.minimal;
}

// ============================================================
// BUTTON STYLE
// ============================================================

export function getButtonStyleClass(
  buttonStyle: OnlineStoreButtonStyle,
): string {
  const map: Record<OnlineStoreButtonStyle, string> = {
    rounded: "rounded-lg",
    pill: "rounded-full",
    "soft-square": "rounded-md",
  };
  return map[buttonStyle] || map.pill;
}

// ============================================================
// PRODUCT LAYOUT
// ============================================================

export function getProductLayoutClass(
  layout: OnlineStoreProductLayout,
): string {
  const map: Record<OnlineStoreProductLayout, string> = {
    grid: "grid grid-cols-2 gap-3",
    horizontal: "flex overflow-x-auto gap-3 snap-x snap-mandatory",
    compact: "grid grid-cols-1 gap-2",
  };
  return map[layout] || map.grid;
}

export function getProductCardWidthClass(
  layout: OnlineStoreProductLayout,
): string {
  const map: Record<OnlineStoreProductLayout, string> = {
    grid: "w-full",
    horizontal: "min-w-[160px] max-w-[180px] snap-start",
    compact: "w-full",
  };
  return map[layout] || map.grid;
}

// ============================================================
// DESKTOP LAYOUT
// ============================================================

export function getDesktopLayoutClass(
  layout: OnlineStoreDesktopLayout,
): string {
  const map: Record<OnlineStoreDesktopLayout, string> = {
    "mobile-centered": "max-w-[430px] mx-auto",
    "wide-ecommerce": "w-full max-w-7xl mx-auto",
    "with-cart-sidebar": "w-full max-w-7xl mx-auto flex",
  };
  return map[layout] || map["mobile-centered"];
}

// ============================================================
// CSS VARIABLES MAPPER
// ============================================================

/**
 * Genera el objeto de estilos CSS variables para inyectar en el wrapper principal.
 */
export function getStoreCSSVariables(settings: {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  whatsappColor: string;
}): Record<string, string> {
  return {
    "--store-primary": settings.primaryColor,
    "--store-secondary": settings.secondaryColor,
    "--store-background": settings.backgroundColor,
    "--store-surface": settings.surfaceColor,
    "--store-text": settings.textColor,
    "--store-muted": settings.mutedTextColor,
    "--store-whatsapp": settings.whatsappColor,
  } as Record<string, string>;
}

/**
 * Helper para convertir hex a RGB (para usar con opacidad)
 */
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0, 0, 0";
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
