/**
 * Fuente canónica de tokens visuales KNOWLEDGE,cloud.
 *
 * Único lugar donde viven los valores cromáticos literales del producto.
 * `globals.css` y `storefront-theme.css` declaran estos mismos valores en
 * CSS; el test `know-design-system.test.ts` verifica que no diverjan.
 */

export const PRIMITIVES = {
  cobalto: "#1737c8",
  profundo: "#0d1b7e",
  electrico: "#3155ff",
  palido: "#b9c7ff",
  blanco: "#ffffff",
  blancoCalido: "#f6f5f1",
  grisFondo: "#ececea",
  grisClaro: "#d9d9d9",
  grisMedio: "#777777",
  carbon: "#202020",
  negroProfundo: "#080808",
} as const;

const p = PRIMITIVES;

/** Colores externos autorizados: marcas de terceros, proveedores de pago,
 * estados, swatches de categoría, presets del storefront y reportes. No
 * forman parte de la identidad KNOWLEDGE,cloud pero están permitidos porque
 * representan entidades externas o significado funcional (estado, marca de
 * terceros) que no puede tokenizarse contra la paleta propia. */
export const EXTERNAL_COLORS: Record<string, string> = {
  "--brand-instagram": "#e1306c",
  "--brand-facebook": "#1877f2",
  "--brand-youtube": "#ff0000",
  "--brand-whatsapp": "#25d366",
  "--brand-tiktok": "#111827",
  "--provider-mercadopago": "#009ee3",
  "--provider-mercadopago-hover": "#008aca",
  "--provider-paypal": "#ffc439",
  "--provider-paypal-hover": "#f2ba36",
  "--provider-paypal-foreground": "#003087",
  "--status-danger": "#ef4444",
  "--status-warning": "#f59e0b",
  "--status-success": "#22c55e",
  "--status-success-strong": "#10b981",
  "--swatch-1": "#000000",
  "--swatch-2": "#171717",
  "--swatch-3": "#1e293b",
  "--swatch-4": "#dc2626",
  "--swatch-5": "#ea580c",
  "--swatch-6": "#16a34a",
  "--swatch-7": "#0284c7",
  "--swatch-8": "#0891b2",
  "--swatch-9": "#854d0e",
  "--swatch-10": "#db2777",
  "--swatch-11": "#7c3aed",
  "--swatch-12": "#4f46e5",
  "--theme-modern-primary": "#000000",
  "--theme-modern-secondary": "#f3f4f6",
  "--theme-modern-accent": "#374151",
  "--theme-nature-primary": "#16a34a",
  "--theme-nature-secondary": "#dcfce7",
  "--theme-nature-accent": "#86efac",
  "--theme-ocean-primary": "#0284c7",
  "--theme-ocean-secondary": "#e0f2fe",
  "--theme-ocean-accent": "#7dd3fc",
  "--theme-sunset-primary": "#ea580c",
  "--theme-sunset-secondary": "#ffedd5",
  "--theme-sunset-accent": "#fdba74",
  "--theme-luxury-primary": "#854d0e",
  "--theme-luxury-secondary": "#fefce8",
  "--theme-luxury-accent": "#d97706",
  "--theme-minimal-primary": "#171717",
  "--theme-minimal-secondary": "#ffffff",
  "--theme-minimal-accent": "#a3a3a3",
  "--theme-barbie-primary": "#db2777",
  "--theme-barbie-secondary": "#fce7f3",
  "--theme-barbie-accent": "#f9a8d4",
  "--theme-tech-primary": "#4f46e5",
  "--theme-tech-secondary": "#e0e7ff",
  "--theme-tech-accent": "#a5b4fc",
  "--brand-default-primary": "#294c98",
  "--wa-screen": "#e5ddd5",
  "--wa-screen-dark": "#0b141a",
  "--wa-header": "#075e54",
  "--wa-header-dark": "#1f2c34",
  "--wa-chip-dark": "#1d2a31",
  "--wa-message": "#d9fdd3",
  "--wa-message-dark": "#005c4b",
  "--wa-input": "#f0f2f5",
  "--wa-input-dark": "#1f2c34",
  "--wa-input-inner-dark": "#2a3942",
  "--wa-check": "#53bdeb",
  "--wa-mic": "#00a884",
  "--traffic-red": "#ff5f57",
  "--traffic-yellow": "#febc2e",
  "--traffic-green": "#28c840",
  "--ui-fx-cyan": "#00fff1",
  "--ui-fx-magenta": "#ff00aa",
  "--ui-fx-orange": "#ffaa40",
  "--ui-fx-purple": "#9c40ff",
  "--ui-fx-violet": "#9e7aff",
  "--ui-fx-pink": "#fe8bbb",
  "--ui-fx-soft-pink": "#ffd1dc",
  "--ui-fx-dark-surface": "#262626",
  "--ui-fx-white": "#ffffff",
  "--overlay-dark-strong": "#0a0a0a",
  "--report-paper": "#ffffff",
  "--report-surface": "#f9fafb",
  "--report-line": "#e5e7eb",
  "--report-line-soft": "#f3f4f6",
  "--report-text": "#111827",
  "--report-text-strong": "#1f2937",
  "--report-text-muted": "#6b7280",
  "--report-text-subtle": "#9ca3af",
  "--report-link": "#2563eb",
  "--report-highlight": "#d97706",
  "--report-rose": "#e11d48",
  "--report-own-bg": "#fee2e2",
  "--report-own-text": "#dc2626",
  "--report-shared-bg": "#fef3c7",
  "--report-shared-text": "#b45309",
};

const danger = EXTERNAL_COLORS["--status-danger"];
const success = EXTERNAL_COLORS["--status-success"];

export const LIGHT_THEME: Record<string, string> = {
  "--background": p.blancoCalido,
  "--foreground": p.carbon,
  "--card": p.blanco,
  "--card-foreground": p.carbon,
  "--popover": p.blanco,
  "--popover-foreground": p.carbon,
  "--primary": p.cobalto,
  "--primary-foreground": p.blanco,
  "--secondary": p.grisFondo,
  "--secondary-foreground": p.carbon,
  "--muted": p.grisFondo,
  "--muted-foreground": p.grisMedio,
  "--accent": p.palido,
  "--accent-foreground": p.carbon,
  "--destructive": danger,
  "--destructive-foreground": p.blanco,
  "--border": p.grisClaro,
  "--input": p.grisClaro,
  "--ring": p.electrico,
  "--success": success,
  "--success-foreground": p.carbon,
  "--chart-1": "var(--primary)",
  "--chart-2": "var(--success)",
  "--chart-3": "#2f80ed",
  "--chart-4": "#d97706",
  "--chart-5": danger,
};

/** El modo oscuro sólo redefine lo que cambia; chart-3/4/5 heredan de :root. */
export const DARK_THEME: Record<string, string> = {
  "--background": p.negroProfundo,
  "--foreground": p.blancoCalido,
  "--card": p.carbon,
  "--card-foreground": p.blancoCalido,
  "--popover": p.carbon,
  "--popover-foreground": p.blancoCalido,
  "--primary": p.electrico,
  "--primary-foreground": p.blanco,
  "--secondary": `color-mix(in oklab, ${p.carbon} 70%, ${p.grisMedio} 30%)`,
  "--secondary-foreground": p.blancoCalido,
  "--muted": `color-mix(in oklab, ${p.carbon} 55%, ${p.negroProfundo} 45%)`,
  "--muted-foreground": p.grisClaro,
  "--accent": p.profundo,
  "--accent-foreground": p.blancoCalido,
  "--destructive": danger,
  "--destructive-foreground": p.blanco,
  "--border": `color-mix(in oklab, ${p.grisMedio} 45%, transparent)`,
  "--input": `color-mix(in oklab, ${p.grisMedio} 55%, transparent)`,
  "--ring": p.palido,
  "--success": success,
  "--success-foreground": p.negroProfundo,
  "--chart-1": "var(--primary)",
  "--chart-2": "var(--success)",
};

/** Escala tipográfica Satoshi (datos para Fase 2; todavía no se carga la
 * fuente ni se aplica a componentes en esta fase). */
export const TYPE_SCALE = {
  display: { size: "clamp(72px, 8vw, 112px)", lineHeight: "92%", weight: 300 },
  h1: { size: "clamp(48px, 6vw, 64px)", lineHeight: "105%", weight: 400 },
  h2: { size: "clamp(28px, 3vw, 36px)", lineHeight: "115%", weight: 500 },
  subtitle: { size: "clamp(20px, 2vw, 24px)", lineHeight: "130%", weight: 500 },
  body: { size: "clamp(16px, 1.2vw, 18px)", lineHeight: "160%", weight: 400 },
  caption: { size: "clamp(12px, 1vw, 14px)", lineHeight: "150%", weight: 400 },
} as const;

/** Registro de logos por contexto (Fase 3 lo conecta a `brand-logo.tsx`). */
export const LOGOS = {
  light: "/brand/logo_negro.png",
  dark: "/brand/logo.png",
  favicon: "/brand/logo.png",
  print: "/brand/logo_negro.png",
} as const;

/** Genera un bloque CSS `selector { --var: valor; ... }` a partir de un mapa
 * de tokens. Usado por tests de paridad y por consumidores server-side
 * (ej. `report-theme.ts`) que necesitan inyectar CSS en HTML generado. */
export function generateThemeCss(
  selector: string,
  vars: Record<string, string>,
): string {
  const declarations = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
  return `${selector} {\n${declarations}\n}`;
}
