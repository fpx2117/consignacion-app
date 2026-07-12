import { Inter } from "next/font/google";
import { CatalogClient } from "./catalog-client";
import "./storefront.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const THEME_COLORS: Record<string, { primary: string; secondary: string; bg: string; text: string }> = {
  modern:   { primary: "#0891b2", secondary: "#22d3ee", bg: "#f0f9ff", text: "#164e63" },
  nature:   { primary: "#166534", secondary: "#22c55e", bg: "#f0fdf4", text: "#14532d" },
  ocean:    { primary: "#1e40af", secondary: "#06b6d4", bg: "#f0f9ff", text: "#1e3a5f" },
  sunset:   { primary: "#c2410c", secondary: "#f59e0b", bg: "#fffbeb", text: "#7c2d12" },
  luxury:   { primary: "#1e293b", secondary: "#c9a84c", bg: "#fafaf9", text: "#1c1917" },
  minimal:  { primary: "#000000", secondary: "#6b7280", bg: "#ffffff", text: "#000000" },
  barbie:   { primary: "#db2777", secondary: "#f472b6", bg: "#fdf2f8", text: "#831843" },
  tech:     { primary: "#6366f1", secondary: "#818cf8", bg: "#0f172a", text: "#f1f5f9" },
};

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0, 0, 0";
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

function getContrastColor(hex: string) {
  const parts = hexToRgb(hex).split(", ").map(Number);
  const brightness = (parts[0] * 299 + parts[1] * 587 + parts[2] * 114) / 1000;
  return brightness > 155 ? "hsl(var(--foreground))" : "hsl(var(--background))";
}

export function renderCatalogPage(
  sucursalId: number,
  checkoutReturnStatus: "success" | "failure" | "pending" | null,
) {
  const themeId = "modern";
  const primaryColor = "#111827";
  const secondaryColor = "#3b82f6";
  const tc = THEME_COLORS[themeId] || THEME_COLORS.modern;
  const resolvedPrimary = tc.primary;
  const resolvedSecondary = tc.secondary;

  const brandingPrimaryRgb = hexToRgb(primaryColor);
  const brandingSecondaryRgb = hexToRgb(secondaryColor);

  const storePrimary = "#007AFF";
  const storeSecondary = "#EAF3FF";
  const storeBg = "#FFFFFF";
  const storeSurface = "#FFFFFF";
  const storeText = "#0F172A";
  const storeMuted = "#8A8F98";
  const storeWhatsapp = "#25D366";

  const cssVars = `
:root {
  --branding-primary: ${primaryColor};
  --branding-primary-rgb: ${brandingPrimaryRgb};
  --branding-secondary: ${secondaryColor};
  --branding-secondary-rgb: ${brandingSecondaryRgb};
  --theme-primary: ${resolvedPrimary};
  --theme-secondary: ${resolvedSecondary};
  --theme-bg: ${tc.bg};
  --theme-text: ${tc.text};
  --primary: ${primaryColor};
  --primary-rgb: ${brandingPrimaryRgb};
  --primary-foreground: ${getContrastColor(primaryColor)};
  --secondary: ${secondaryColor};
  --secondary-foreground: ${getContrastColor(secondaryColor)};
  --store-canvas: ${tc.bg};
  --store-surface: ${tc.bg === "#0f172a" ? "#1e293b" : "#ffffff"};
  --store-surface-rgb: ${hexToRgb(tc.bg === "#0f172a" ? "#1e293b" : "#ffffff")};

  /* Online Store overrides */
  --store-primary-override: ${storePrimary};
  --store-primary-rgb-override: ${hexToRgb(storePrimary)};
  --store-secondary-override: ${storeSecondary};
  --store-background-override: ${storeBg};
  --store-surface-override: ${storeSurface};
  --store-surface-rgb-override: ${hexToRgb(storeSurface)};
  --store-text-override: ${storeText};
  --store-muted-override: ${storeMuted};
  --store-whatsapp-override: ${storeWhatsapp};
  --store-whatsapp-rgb-override: ${hexToRgb(storeWhatsapp)};
}
`;

  return (
    <>
      {/* Preload de imágenes del comercio para carga instantánea */}
      <link rel="preload" as="image" href={`/api/public/branding-media?type=banner&sucursalId=${sucursalId}`} />
      <link rel="preload" as="image" href={`/api/public/branding-media?type=logo&sucursalId=${sucursalId}`} />
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div data-theme={themeId} data-store-config="true" className={inter.className}>
        <CatalogClient
          initialData={null}
          initialError={null}
          sucursalId={sucursalId}
          checkoutReturnStatus={checkoutReturnStatus}
        />
      </div>
    </>
  );
}
