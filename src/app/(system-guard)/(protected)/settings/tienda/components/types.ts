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
  storeName?: string;
  nombreTienda?: string;
  banners?: Array<{
    bannerData: string;
    bannerMime: string;
    url?: string;
  }>;
};

export type StoreLayoutConfig = {
  tiendaLayout: StoreLayoutMode;
  mostrarCategoriasEnHeader: boolean;
  convertirTienda: boolean;
  mostrarPreciosConsignacion: boolean;
  mostrarBuscador: boolean;
};
