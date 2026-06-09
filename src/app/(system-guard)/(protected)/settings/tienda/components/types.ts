import type { StorefrontContent } from "@/lib/storefront-content";

export type StoreThemeId =
  | "modern"
  | "nature"
  | "ocean"
  | "sunset"
  | "luxury"
  | "minimal"
  | "barbie"
  | "tech";

export type StoreLayoutMode = "grid" | "list";

export type BrandingPreviewSettings = {
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
  themeIdentifier?: StoreThemeId | string;
  logoData?: string | null;
  logoMime?: string | null;
  logoUrl?: string | null;
  bannerData?: string | null;
  bannerMime?: string | null;
  bannerUrl?: string | null;
  typography?: string;
  isBannerSlider?: boolean;
  storefrontContent?: StorefrontContent | null;
  storeName?: string;
  nombreTienda?: string;
  banners?: Array<{
    bannerData: string;
    bannerMime: string;
    url?: string;
  }>;
  // Online Store — Identidad
  openingHours?: string;
  addressText?: string;
  description?: string;
  // Online Store — Tema
  mode?: "light" | "dark" | "system";
  borderRadius?: "sm" | "md" | "lg" | "xl" | "2xl";
  shadow?: "none" | "soft" | "medium" | "strong";
  cardStyle?: "minimal" | "elevated" | "bordered";
  buttonStyle?: "rounded" | "pill" | "soft-square";
};

export type StoreLayoutConfig = {
  tiendaLayout: StoreLayoutMode;
  mostrarCategoriasEnHeader: boolean;
  convertirTienda: boolean;
  mostrarPreciosConsignacion: boolean;
  mostrarBuscador: boolean;
  // Online Store — Catálogo
  showProductImages: boolean;
  showPrices: boolean;
  showStock: boolean;
  showViewAll: boolean;
  productLayout: "grid" | "horizontal" | "compact";
  maxProductsPerSection: number;
  addButtonPosition: "floating" | "below";
  // Online Store — Carrito
  cartDisplayMode: "bottom-sheet" | "modal" | "drawer";
  showWhatsappPreview: boolean;
  whatsappButtonText: string;
  // Online Store — Responsive
  desktopLayout: "mobile-centered" | "wide-ecommerce" | "with-cart-sidebar";
  // Online Store — Destacados
  featuredProductIds: number[];
  featuredSections: Array<{ title: string; productIds: number[]; displayMode: "slider-auto" | "slider-static" | "grid" }>;
};

export type OnlineStorePromoFormItem = {
  id: string;
  icon: string;
  title: string;
  description: string;
  backgroundColor: string;
  textColor: string;
  order: number;
  visible: boolean;
};
