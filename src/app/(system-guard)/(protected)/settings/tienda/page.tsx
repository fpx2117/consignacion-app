"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  Eye,
  Globe,
  Laptop,
  Layout,
  Loader2,
  Palette,
  RefreshCw,
  Save,
  Smartphone,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { apiService } from "@/lib/apiService";
import { createDefaultStorefrontContent } from "@/lib/storefront/storefront-content";
import { TIENDA_TUTORIAL } from "@/lib/tutorial-content";
import type { Categoria } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TutorialButton } from "@/components/ui/tutorial-button";

import { BrandingTab } from "./components/BrandingTab";
import { HomeTab } from "./components/HomeTab";
import { LayoutTab } from "./components/LayoutTab";
import { SocialTab } from "./components/SocialTab";
import { StorePreviewArea } from "./components/StorePreviewArea";
import { ThemesTab } from "./components/ThemesTab";

type SettingCategory = "branding" | "home" | "layout" | "themes" | "social";

type BrandingSettings = {
  businessName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  footerText?: string;
  phone?: string;
  address?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  whatsappNumber?: string;
  googleMapsUrl?: string;
  themeIdentifier?: string;
  logoData?: string | null;
  logoMime?: string | null;
  bannerData?: string | null;
  bannerMime?: string | null;
  typography?: string;
  isBannerSlider?: boolean;
  banners?: Array<{ bannerData: string; bannerMime: string }>;
  storefrontContent?: ReturnType<typeof createDefaultStorefrontContent> | null;
  [key: string]: unknown;
};

type StoreConfig = {
  tiendaLayout: "grid" | "list";
  mostrarCategoriasEnHeader: boolean;
  convertirTienda: boolean;
  mostrarPreciosConsignacion: boolean;
  mostrarBuscador: boolean;
  showProductImages: boolean;
  showPrices: boolean;
  showStock: boolean;
  showViewAll: boolean;
  productLayout: "grid" | "horizontal" | "compact";
  maxProductsPerSection: number;
  addButtonPosition: "floating" | "below";
  cartDisplayMode: "bottom-sheet" | "modal" | "drawer";
  showWhatsappPreview: boolean;
  whatsappButtonText: string;
  desktopLayout: "mobile-centered" | "wide-ecommerce" | "with-cart-sidebar";
  featuredProductIds: number[];
  featuredSections: Array<{ title: string; productIds: number[]; displayMode: "slider-auto" | "slider-static" | "grid" }>;
  [key: string]: unknown;
};

const CATEGORIES: Array<{
  id: SettingCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "branding",
    label: "Identidad",
    description: "Logo, colores y tipografia",
    icon: Palette,
  },
  {
    id: "home",
    label: "Home",
    description: "Hero, bloques y textos comerciales",
    icon: Sparkles,
  },
  {
    id: "layout",
    label: "Estructura",
    description: "Grilla, filtros y visibilidad",
    icon: Layout,
  },
  {
    id: "themes",
    label: "Temas",
    description: "Paletas listas para usar",
    icon: Star,
  },
  {
    id: "social",
    label: "Redes",
    description: "Canales de contacto",
    icon: Globe,
  },
];

  // ── Defaults con todos los campos OLS ──
  const DEFAULT_BRANDING: BrandingSettings = {
    businessName: "",
    primaryColor: "#007AFF",
    secondaryColor: "#EAF3FF",
    footerText: "",
    phone: "",
    address: "",
    instagramUrl: "",
    tiktokUrl: "",
    facebookUrl: "",
    youtubeUrl: "",
    whatsappNumber: "",
    googleMapsUrl: "",
    themeIdentifier: "modern",
    logoData: null,
    logoMime: null,
    bannerData: null,
    bannerMime: null,
    typography: "Inter",
    isBannerSlider: false,
    banners: [],
    storefrontContent: createDefaultStorefrontContent(),
    openingHours: "",
    addressText: "",
    description: "",
    mode: "light",
    borderRadius: "2xl",
    shadow: "soft",
    cardStyle: "minimal",
    buttonStyle: "pill",
    backgroundColor: "#F5F6F8",
    surfaceColor: "#FFFFFF",
    textColor: "#0F172A",
    mutedTextColor: "#8A8F98",
    whatsappColor: "#25D366",
  };

const DEFAULT_CONFIG: StoreConfig = {
  tiendaLayout: "grid",
  mostrarCategoriasEnHeader: true,
  convertirTienda: true,
  mostrarPreciosConsignacion: false,
  mostrarBuscador: true,
  showProductImages: true,
  showPrices: true,
  showStock: false,
  showViewAll: true,
  productLayout: "grid",
  maxProductsPerSection: 6,
  addButtonPosition: "floating",
  cartDisplayMode: "bottom-sheet",
  showWhatsappPreview: true,
  whatsappButtonText: "Enviar pedido por WhatsApp",
  desktopLayout: "mobile-centered",
  featuredProductIds: [],
  featuredSections: [],
};

function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl bg-muted/60 relative overflow-hidden", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    </div>
  );
}

const VALID_TABS: SettingCategory[] = ["branding", "home", "layout", "themes", "social"];

export default function TiendaSettingsPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<SettingCategory>(() => {
    const tabParam = searchParams.get("tab");
    return VALID_TABS.includes(tabParam as SettingCategory) ? (tabParam as SettingCategory) : "branding";
  });
  const [previewMode, setPreviewMode] = React.useState<"mobile" | "desktop">("desktop");
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [showSavedCheck, setShowSavedCheck] = React.useState(false);
  const [previewPortalReady, setPreviewPortalReady] = React.useState(false);

  const [branding, setBranding] = React.useState<BrandingSettings>(DEFAULT_BRANDING);
  const [config, setConfig] = React.useState<StoreConfig>(DEFAULT_CONFIG);
  const [categoriesPreview, setCategoriesPreview] = React.useState<Categoria[]>([]);

  const setBrandingWithDirty = React.useCallback(
    (value: React.SetStateAction<BrandingSettings>) => {
      setBranding(value);
      setIsDirty(true);
    },
    [],
  );

  const setConfigWithDirty = React.useCallback(
    (value: React.SetStateAction<StoreConfig>) => {
      setConfig(value);
      setIsDirty(true);
    },
    [],
  );

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [brandingRes, configRes, categoriasRes] = await Promise.all([
        apiService.getBranding(),
        apiService.getConfiguracionGeneral(),
        apiService.getCategorias(),
      ]);

      // Cargar onlineStoreConfig guardado desde StoreSettings
      let savedOls: Record<string, unknown> | null = null;
      try {
        const olsRes = await fetch("/api/settings");
        if (olsRes.ok) {
          const olsJson = await olsRes.json();
          savedOls = olsJson?.data?.onlineStoreConfig ?? null;
        }
      } catch { /* si falla, usamos defaults */ }

      // ── Poblar branding con datos de Branding + OLS ──
      if (brandingRes) {
        const b = brandingRes as Record<string, unknown>;
        const olsTheme = (savedOls?.theme ?? {}) as Record<string, unknown>;
        const ols = savedOls ?? {};
        setBranding((prev) => ({
          ...prev,
          ...(brandingRes as Partial<BrandingSettings>),
          storefrontContent: (b.storefrontContent as BrandingSettings["storefrontContent"]) ?? prev.storefrontContent,
          // Sincronizar desde OLS si existe (prioridad sobre branding viejo)
          businessName: (ols.storeName as string) || (b.businessName as string) || prev.businessName,
          openingHours: (ols.openingHours as string) || (b.openingHours as string) || prev.openingHours || "",
          addressText: (ols.addressText as string) || (b.addressText as string) || prev.addressText || "",
          description: (ols.description as string) || (b.description as string) || prev.description || "",
          primaryColor: (olsTheme.primaryColor as string) || (b.primaryColor as string) || prev.primaryColor || "#007AFF",
          secondaryColor: (olsTheme.secondaryColor as string) || (b.secondaryColor as string) || prev.secondaryColor || "#EAF3FF",
          backgroundColor: (olsTheme.backgroundColor as string) || prev.backgroundColor || "#F5F6F8",
          surfaceColor: (olsTheme.surfaceColor as string) || prev.surfaceColor || "#FFFFFF",
          textColor: (olsTheme.textColor as string) || prev.textColor || "#0F172A",
          mutedTextColor: (olsTheme.mutedTextColor as string) || prev.mutedTextColor || "#8A8F98",
          whatsappColor: (olsTheme.whatsappColor as string) || prev.whatsappColor || "#25D366",
          mode: (olsTheme.mode as BrandingSettings["mode"]) || prev.mode,
          borderRadius: (olsTheme.borderRadius as BrandingSettings["borderRadius"]) || prev.borderRadius,
          shadow: (olsTheme.shadow as BrandingSettings["shadow"]) || prev.shadow,
          cardStyle: (olsTheme.cardStyle as BrandingSettings["cardStyle"]) || prev.cardStyle,
          buttonStyle: (olsTheme.buttonStyle as BrandingSettings["buttonStyle"]) || prev.buttonStyle,
        }));
      }

      // ── Poblar config con datos de Configuracion + OLS ──
      if (configRes) {
        const olsCatalog = (savedOls?.catalog || {}) as Record<string, unknown>;
        const olsCart = (savedOls?.cart || {}) as Record<string, unknown>;
        const olsResponsive = (savedOls?.responsive || {}) as Record<string, unknown>;
        setConfig((prev) => ({
          ...prev,
          ...(configRes as Partial<StoreConfig>),
          // Sincronizar desde OLS (prioridad sobre config vieja)
          showProductImages: (olsCatalog.showProductImages as boolean | undefined) ?? (configRes as Record<string, unknown>).showProductImages as boolean ?? prev.showProductImages,
          showPrices: (olsCatalog.showPrices as boolean | undefined) ?? (configRes as Record<string, unknown>).showPrices as boolean ?? prev.showPrices,
          showStock: (olsCatalog.showStock as boolean | undefined) ?? (configRes as Record<string, unknown>).showStock as boolean ?? prev.showStock,
          showViewAll: (olsCatalog.showViewAll as boolean | undefined) ?? (configRes as Record<string, unknown>).showViewAll as boolean ?? prev.showViewAll,
          productLayout: ((olsCatalog.productLayout as StoreConfig["productLayout"]) ?? (configRes as Record<string, unknown>).productLayout as StoreConfig["productLayout"] ?? prev.productLayout),
          maxProductsPerSection: (olsCatalog.maxProductsPerSection as number | undefined) ?? (configRes as Record<string, unknown>).maxProductsPerSection as number ?? prev.maxProductsPerSection,
          addButtonPosition: ((olsCatalog.addButtonPosition as StoreConfig["addButtonPosition"]) ?? (configRes as Record<string, unknown>).addButtonPosition as StoreConfig["addButtonPosition"] ?? prev.addButtonPosition),
          featuredProductIds: (Array.isArray(olsCatalog.featuredProductIds) ? olsCatalog.featuredProductIds as number[] : (configRes as Record<string, unknown>).featuredProductIds as number[] ?? prev.featuredProductIds),
          featuredSections: (Array.isArray(olsCatalog.featuredSections) ? olsCatalog.featuredSections as StoreConfig["featuredSections"] : (configRes as Record<string, unknown>).featuredSections as StoreConfig["featuredSections"] ?? prev.featuredSections),
          cartDisplayMode: ((olsCart.displayMode as StoreConfig["cartDisplayMode"]) ?? (configRes as Record<string, unknown>).cartDisplayMode as StoreConfig["cartDisplayMode"] ?? prev.cartDisplayMode),
          showWhatsappPreview: (olsCart.showWhatsappPreview as boolean | undefined) ?? (configRes as Record<string, unknown>).showWhatsappPreview as boolean ?? prev.showWhatsappPreview,
          whatsappButtonText: (olsCart.whatsappButtonText as string | undefined) ?? (configRes as Record<string, unknown>).whatsappButtonText as string ?? prev.whatsappButtonText,
          desktopLayout: ((olsResponsive.desktopLayout as StoreConfig["desktopLayout"]) ?? (configRes as Record<string, unknown>).desktopLayout as StoreConfig["desktopLayout"] ?? prev.desktopLayout),
          // Sincronizar showCategories con mostrarCategoriasEnHeader
          mostrarCategoriasEnHeader: (olsCatalog.showCategories as boolean) ?? (configRes as any).mostrarCategoriasEnHeader ?? prev.mostrarCategoriasEnHeader,
        }));
      }

      setCategoriesPreview(Array.isArray(categoriasRes) ? categoriasRes : []);

      setIsDirty(false);
    } catch {
      toast.error("No se pudo cargar la configuracion de la tienda");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    setPreviewPortalReady(true);
  }, []);

  React.useEffect(() => {
    if (!isPreviewOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPreviewOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isPreviewOpen]);

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    try {
      // Construir onlineStoreConfig desde branding + config + estado local
      const builtOnlineStoreConfig = {
        storeName: (branding as any).businessName || branding.storeName || "Mi tienda",
        storeLogoUrl: branding.logoUrl || null,
        storeBannerUrl: branding.bannerUrl || null,
        description: (branding as any).description || "",
        openingHours: (branding as any).openingHours || "",
        addressText: (branding as any).addressText || branding.address || "",
        theme: {
          primaryColor: branding.primaryColor || "#007AFF",
          secondaryColor: branding.secondaryColor || "#EAF3FF",
          backgroundColor: (branding as any).backgroundColor || "#F5F6F8",
          surfaceColor: (branding as any).surfaceColor || "#FFFFFF",
          textColor: (branding as any).textColor || "#0F172A",
          mutedTextColor: (branding as any).mutedTextColor || "#8A8F98",
          whatsappColor: (branding as any).whatsappColor || "#25D366",
          mode: (branding as any).mode || "light",
          borderRadius: (branding as any).borderRadius || "2xl",
          shadow: (branding as any).shadow || "soft",
          cardStyle: (branding as any).cardStyle || "minimal",
          buttonStyle: (branding as any).buttonStyle || "pill",
        },
        catalog: {
          showCategories: config.mostrarCategoriasEnHeader,
          showProductImages: config.showProductImages,
          showPrices: config.showPrices,
          showStock: config.showStock,
          showViewAll: config.showViewAll,
          productLayout: config.productLayout,
          maxProductsPerSection: config.maxProductsPerSection,
          addButtonPosition: config.addButtonPosition,
          featuredProductIds: config.featuredProductIds || [],
          featuredSections: config.featuredSections || [],
        },
        promotions: { enabled: true, items: [] },
        cart: {
          displayMode: config.cartDisplayMode,
          showWhatsappPreview: config.showWhatsappPreview,
          whatsappButtonText: config.whatsappButtonText,
          messageTemplate: {
            greeting: "Hola",
            intro: "Quisiera realizar el siguiente pedido:",
            subtotalLabel: "Subtotal",
            totalLabel: "Total",
            footer: "",
          },
        },
        responsive: {
          desktopLayout: config.desktopLayout,
        },
      };

      // Limpiar campos binarios pesados (logo/banner) — ya están en DB, no hace falta reenviarlos
      const cleanBranding = { ...branding } as Record<string, unknown>;
      delete cleanBranding.logoData;
      delete cleanBranding.bannerData;
      delete cleanBranding.banners;

      await Promise.all([
        apiService.actualizarBranding(cleanBranding as any),
        apiService.actualizarConfiguracionGeneral({
          tiendaLayout: config.tiendaLayout,
          mostrarCategoriasEnHeader: config.mostrarCategoriasEnHeader,
          convertirTienda: config.convertirTienda,
          mostrarPreciosConsignacion: config.mostrarPreciosConsignacion,
          mostrarBuscador: config.mostrarBuscador,
        }),
        fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onlineStoreConfig: builtOnlineStoreConfig }),
        }),
      ]);

      setIsDirty(false);
      setShowSavedCheck(true);
      window.setTimeout(() => setShowSavedCheck(false), 2200);
      toast.success("Configuracion guardada");
    } catch {
      toast.error("No se pudo guardar la configuracion");
    } finally {
      setSaving(false);
    }
  }, [branding, config]);

  const handleImageUpload = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, type: "logo" | "banner") => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 20 * 1024 * 1024) {
        toast.error("La imagen supera el maximo de 20MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const [mimeInfo, data] = base64String.split(";base64,");
        const mime = mimeInfo?.split(":")[1] ?? "image/png";

        if (!data) return;

        if (type === "logo") {
          setBrandingWithDirty((prev) => ({ ...prev, logoData: data, logoMime: mime }));
          return;
        }

        setBrandingWithDirty((prev) => ({ ...prev, bannerData: data, bannerMime: mime }));
      };

      reader.readAsDataURL(file);
    },
    [setBrandingWithDirty],
  );

  const activeCategory = CATEGORIES.find((category) => category.id === activeTab);
  const hasMercadoPagoCredentials =
    String(config.mpAccessTokenTienda ?? "").trim().length > 0 &&
    String(config.mpPublicKeyTienda ?? "").trim().length > 0;
  const tiendaMetodoPagoActual = (config.tiendaMetodoPago as "whatsapp" | "mercadopago" | undefined) ?? "whatsapp";
  const storeModeLabel = !config.convertirTienda
    ? "Carrito desactivado"
    : tiendaMetodoPagoActual === "mercadopago"
      ? hasMercadoPagoCredentials
        ? "Modo Tienda (Mercado Pago)"
        : "Mercado Pago (faltan credenciales)"
      : "Modo Catalogo (WhatsApp)";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <style jsx global>{`
          @keyframes shimmer {
            100% {
              transform: translateX(100%);
            }
          }
        `}</style>

        <div className="h-16 border-b px-4 sm:px-6 flex items-center gap-3">
          <SkeletonBox className="h-8 w-8" />
          <SkeletonBox className="h-4 w-48" />
          <div className="flex-1" />
          <SkeletonBox className="h-9 w-28" />
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="border-r hidden lg:block p-6 space-y-3">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
          </div>
          <div className="p-4 sm:p-8 space-y-4">
            <SkeletonBox className="h-16 w-full" />
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>

      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="px-3 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <Link href="/settings" aria-label="Volver a configuracion">
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>

              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Configuracion de tienda
                </p>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">
                    Personalizar experiencia del cliente
                  </h1>
                  <TutorialButton steps={TIENDA_TUTORIAL} />
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
              {isDirty && (
                <span className="hidden md:flex items-center gap-1 text-[11px] text-[color:var(--status-warning)] dark:text-[color:var(--status-warning)] font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-warning)] animate-pulse" />
                  Cambios pendientes
                </span>
              )}

              {showSavedCheck && !isDirty && (
                <span className="hidden md:flex items-center gap-1 text-[11px] text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)] font-medium">
                  <Check className="h-3.5 w-3.5" />
                  Guardado
                </span>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewOpen(true)}
                className="h-9 rounded-xl hidden sm:inline-flex"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Preview
              </Button>

              {isDirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadData()}
                  className="h-9 rounded-xl hidden md:inline-flex"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Revertir
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || !isDirty}
                className="h-9 rounded-xl px-3 sm:px-4"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : showSavedCheck && !isDirty ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{saving ? "Guardando" : "Guardar"}</span>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.06),transparent_45%)]">
          <aside className="hidden xl:flex flex-col border-r border-border/60 bg-background/80 backdrop-blur">
            <div className="p-5 pb-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
                Secciones
              </p>
            </div>

            <nav className="px-3 pb-4 space-y-1">
              {CATEGORIES.map((category) => {
                const isActive = activeTab === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveTab(category.id)}
                    className={cn(
                      "w-full rounded-2xl px-3 py-3 text-left transition-colors border",
                      isActive
                        ? "bg-primary/10 border-primary/20"
                        : "bg-background border-transparent hover:border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center",
                          isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <category.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{category.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{category.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto p-4">
              <div className="rounded-2xl border border-border/70 bg-background p-3.5">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">Estado de la tienda</p>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      !config.convertirTienda
                        ? "bg-muted-foreground/40"
                        : tiendaMetodoPagoActual === "mercadopago" && !hasMercadoPagoCredentials
                          ? "bg-[color:var(--status-warning)]"
                          : "bg-[color:var(--status-success-strong)]",
                    )}
                  />
                  <p className="text-sm font-medium">{storeModeLabel}</p>
                </div>
              </div>
            </div>
          </aside>

          <ScrollArea className="min-h-0">
            <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-28">
              <div className="xl:hidden mb-5 sm:mb-6 -mx-1 px-1">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {CATEGORIES.map((category) => {
                    const isActive = activeTab === category.id;
                    return (
                      <button
                        key={category.id}
                        onClick={() => setActiveTab(category.id)}
                        className={cn(
                          "shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium inline-flex items-center gap-1.5",
                          isActive
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background text-muted-foreground border-border hover:text-foreground",
                        )}
                      >
                        <category.icon className="h-3.5 w-3.5" />
                        {category.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <section className="mb-5 sm:mb-6 rounded-3xl border border-border/60 bg-background/85 backdrop-blur p-4 sm:p-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      {activeCategory && <activeCategory.icon className="h-5 w-5" />}
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold leading-tight">
                        {activeCategory?.label ?? "Configuracion"}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        {activeCategory?.description}. Ajustes optimizados para desktop, tablet y celular.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full lg:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPreviewOpen(true)}
                      className="rounded-xl h-9"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewMode((prev) => (prev === "desktop" ? "mobile" : "desktop"))}
                      className="rounded-xl h-9"
                    >
                      {previewMode === "desktop" ? (
                        <Smartphone className="h-3.5 w-3.5 mr-1.5" />
                      ) : (
                        <Laptop className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {previewMode === "desktop" ? "Movil" : "Web"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void handleSave()}
                      disabled={saving || !isDirty}
                      className="rounded-xl h-9 col-span-2 sm:col-span-1"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Aplicar
                    </Button>
                  </div>
                </div>
              </section>

              <section
                key={activeTab}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                {activeTab === "branding" && (
                  <BrandingTab
                    branding={branding}
                    setBranding={setBrandingWithDirty}
                    handleImageUpload={handleImageUpload}
                  />
                )}
                {activeTab === "home" && (
                  <HomeTab
                    branding={branding}
                    setBranding={setBrandingWithDirty}
                    categoriesPreview={categoriesPreview}
                  />
                )}
                {activeTab === "layout" && (
                  <LayoutTab config={config} setConfig={setConfigWithDirty} />
                )}
                {activeTab === "themes" && (
                  <ThemesTab branding={branding} setBranding={setBrandingWithDirty} />
                )}
                {activeTab === "social" && (
                  <SocialTab branding={branding} setBranding={setBrandingWithDirty} />
                )}
              </section>
            </div>
          </ScrollArea>
        </div>

        {previewPortalReady &&
          isPreviewOpen &&
          createPortal(
            <div className="fixed inset-0 z-[2147483000] bg-black/58 backdrop-blur-[2px]">
              <div className="h-full w-full flex flex-col">
                <div className="shrink-0 border-b border-border/60 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">Vista previa de tu tienda</p>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Cambia entre dispositivo movil y escritorio.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 p-0.5 bg-muted rounded-xl">
                      <button
                        onClick={() => setPreviewMode("mobile")}
                        className={cn(
                          "h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5",
                          previewMode === "mobile"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        Movil
                      </button>
                      <button
                        onClick={() => setPreviewMode("desktop")}
                        className={cn(
                          "h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5",
                          previewMode === "desktop"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Laptop className="h-3.5 w-3.5" />
                        Web
                      </button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => setIsPreviewOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="relative flex-1 p-3 sm:p-6 bg-gradient-to-br from-background via-muted/35 to-muted/55 dark:from-background dark:via-card dark:to-background flex items-center justify-center overflow-hidden">
                  <div
                    className={cn(
                      "bg-card ring-1 ring-border/60 shadow-2xl transform-gpu transition-all duration-500",
                      previewMode === "mobile"
                        ? "w-[350px] h-[740px] max-h-full rounded-[2.5rem]"
                        : "w-[min(1450px,95vw)] h-[min(820px,88vh)] rounded-2xl",
                    )}
                  >
                    <StorePreviewArea branding={branding} config={config} mode={previewMode} />
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {isDirty && (
          <div className="fixed bottom-5 right-5 sm:hidden z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Button
              size="lg"
              onClick={() => void handleSave()}
              disabled={saving}
              className="h-12 w-12 rounded-full p-0 shadow-lg shadow-primary/30"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
