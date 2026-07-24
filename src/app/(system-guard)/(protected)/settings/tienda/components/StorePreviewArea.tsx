"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Componentes NUEVOS del catálogo
import { StoreHeader } from "@/app/lista/components/store-header";
import { SearchBar } from "@/app/lista/components/search-bar";
import { CategoryTabs } from "@/app/lista/components/category-tabs";
import { ProductSection } from "@/app/lista/components/product-section";
import { DesktopCategorySidebar } from "@/app/lista/components/desktop-category-sidebar";
import { StoreFooter } from "@/app/lista/components/store-footer";
import { getThemeStyles } from "@/app/lista/lib/theme-utils";
import type {
  PublicCatalogConfig,
  PublicCatalogProduct,
  PublicCatalogCategory,
} from "@/lib/types";
import type { BrandingPreviewSettings, StoreLayoutConfig } from "./types";

type PreviewProduct = PublicCatalogProduct;
type PreviewCategory = PublicCatalogCategory;

type StorePreviewProps = {
  branding: BrandingPreviewSettings;
  config: StoreLayoutConfig;
  mode: "mobile" | "desktop";
};

// ─── Mobile Status Bar ───
function MobileStatusBar() {
  const [time, setTime] = React.useState(() => {
    const now = new Date();
    return `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
  });
  React.useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setTime(
        `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`,
      );
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className="relative z-20 flex items-center justify-between px-7 pt-[14px] pb-1 text-[11px] font-semibold text-foreground/80 select-none"
      style={{ fontFamily: '-apple-system, "SF Pro Text", sans-serif' }}
    >
      <span className="w-14 text-left tracking-tight">{time}</span>
      <div className="w-[100px]" />
      <div className="flex items-center gap-[5px] w-14 justify-end">
        <svg
          width="15"
          height="11"
          viewBox="0 0 15 11"
          fill="none"
          className="opacity-80"
        >
          <rect
            x="0"
            y="8"
            width="2.5"
            height="3"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="3.5"
            y="5.5"
            width="2.5"
            height="5.5"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="7"
            y="3"
            width="2.5"
            height="8"
            rx="0.5"
            fill="currentColor"
          />
          <rect
            x="10.5"
            y="0"
            width="2.5"
            height="11"
            rx="0.5"
            fill="currentColor"
          />
        </svg>
        <svg
          width="14"
          height="10"
          viewBox="0 0 14 10"
          fill="none"
          className="opacity-80"
        >
          <path
            d="M7 9.5a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z"
            fill="currentColor"
          />
          <path
            d="M4.2 6.7a3.8 3.8 0 015.6 0"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M2 4.2a7 7 0 0110 0"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <svg
          width="22"
          height="11"
          viewBox="0 0 22 11"
          fill="none"
          className="opacity-80"
        >
          <rect
            x="0.5"
            y="0.5"
            width="18"
            height="10"
            rx="2"
            stroke="currentColor"
            strokeWidth="1"
          />
          <rect x="2" y="2" width="14" height="7" rx="1" fill="currentColor" />
          <path
            d="M20 3.5v4a1.5 1.5 0 000-4z"
            fill="currentColor"
            opacity="0.4"
          />
        </svg>
      </div>
    </div>
  );
}

// ─── Desktop Browser Bar ───
function DesktopBrowserBar({ storeName }: { storeName?: string }) {
  const slug = (storeName || "tu-tienda")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return (
    <div className="relative z-20 flex items-center gap-2.5 px-3.5 py-2 bg-muted/90 border-b border-border/60 select-none shrink-0">
      <div className="flex items-center gap-[6px] shrink-0">
        <span className="h-[10px] w-[10px] rounded-full bg-[color:var(--traffic-red)] shadow-sm" />
        <span className="h-[10px] w-[10px] rounded-full bg-[color:var(--traffic-yellow)] shadow-sm" />
        <span className="h-[10px] w-[10px] rounded-full bg-[color:var(--traffic-green)] shadow-sm" />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1.5 bg-card/80 border border-border/80 rounded-md px-3 py-[3px] text-[11px] max-w-[260px] w-full justify-center">
          <svg
            width="9"
            height="10"
            viewBox="0 0 9 10"
            fill="none"
            className="text-muted-foreground/80 shrink-0"
          >
            <rect
              x="0.5"
              y="4"
              width="8"
              height="5.5"
              rx="1.2"
              stroke="currentColor"
              strokeWidth="1"
            />
            <path
              d="M2.5 4V2.8a2 2 0 014 0V4"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-muted-foreground truncate">
            {slug}.consignacion.app
          </span>
        </div>
      </div>
      <div className="w-[52px] shrink-0" />
    </div>
  );
}

// ─── Preview Component ───
export function StorePreviewArea({
  branding,
  config,
  mode,
}: StorePreviewProps) {
  const isMobile = mode === "mobile";
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<number | null>(
    null,
  );
  const [selectedSubcategory, setSelectedSubcategory] = React.useState<
    number | null
  >(null);

  // Construir config falso compatible con PublicCatalogConfig
  const mergedConfig: PublicCatalogConfig = {
    sucursalId: 1,
    businessName: branding.businessName || branding.storeName || "Mi Tienda",
    primaryColor: branding.primaryColor || "#007AFF",
    secondaryColor: branding.secondaryColor || "#EAF3FF",
    logoData: branding.logoData || null,
    logoMime: branding.logoMime || null,
    bannerData: branding.bannerData || null,
    bannerMime: branding.bannerMime || null,
    logoUrl: branding.logoUrl || null,
    bannerUrl: branding.bannerUrl || null,
    whatsappNumber: branding.whatsappNumber || null,
    address: branding.address || null,
    phone: branding.phone || null,
    footerText: branding.footerText || null,
    typography: branding.typography || "Inter",
    themeIdentifier: branding.themeIdentifier || "modern",
    convertirTienda: config.convertirTienda,
    storefrontContent: branding.storefrontContent || null,
    onlineStoreConfig: {
      storeName: branding.businessName || branding.storeName || "Mi Tienda",
      openingHours: branding.openingHours || "",
      addressText: branding.addressText || "",
      description: branding.description || "",
      theme: {
        primaryColor: branding.primaryColor || "#007AFF",
        secondaryColor: branding.secondaryColor || "#EAF3FF",
        backgroundColor: branding.backgroundColor || "#F5F6F8",
        surfaceColor: branding.surfaceColor || "#FFFFFF",
        textColor: branding.textColor || "#0F172A",
        mutedTextColor: branding.mutedTextColor || "#8A8F98",
        whatsappColor: branding.whatsappColor || "#25D366",
        mode: branding.mode || "light",
        borderRadius: branding.borderRadius || "2xl",
        shadow: branding.shadow || "soft",
        cardStyle: branding.cardStyle || "minimal",
        buttonStyle: branding.buttonStyle || "pill",
      },
      catalog: {
        showCategories: true,
        showProductImages: config.showProductImages,
        showPrices: config.showPrices,
        showStock: config.showStock,
        showViewAll: config.showViewAll,
        productLayout: config.productLayout,
        maxProductsPerSection: config.maxProductsPerSection,
        addButtonPosition: config.addButtonPosition,
        featuredProductIds: [],
        featuredSections: [],
      },
      promotions: { enabled: false, items: [] },
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
      responsive: { desktopLayout: config.desktopLayout },
    },
  };

  const { pageBgClass } = getThemeStyles(mergedConfig.themeIdentifier);

  // Mock data
  const categories: PreviewCategory[] = React.useMemo(
    () => [
      {
        id: 1,
        nombre: "Remeras",
        subcategorias: [
          { id: 11, nombre: "Manga corta" },
          { id: 12, nombre: "Manga larga" },
          { id: 13, nombre: "Estampadas" },
        ],
      },
      {
        id: 2,
        nombre: "Pantalones",
        subcategorias: [
          { id: 21, nombre: "Jeans" },
          { id: 22, nombre: "Joggers" },
        ],
      },
      {
        id: 3,
        nombre: "Accesorios",
        subcategorias: [
          { id: 31, nombre: "Gorras" },
          { id: 32, nombre: "Cinturones" },
        ],
      },
      {
        id: 4,
        nombre: "Calzado",
        subcategorias: [
          { id: 41, nombre: "Zapatillas" },
          { id: 42, nombre: "Botas" },
        ],
      },
    ],
    [],
  );

  const products: PreviewProduct[] = React.useMemo(
    () => [
      {
        id: 1,
        nombre: "Remera Algodón Premium",
        precioVenta: 12900,
        imagenUrl:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80",
        stockDisponibleUnits: 15,
        categoriaId: 1,
        subcategoriaId: 11,
        categoria: { id: 1, nombre: "Remeras" },
      },
      {
        id: 2,
        nombre: "Jean Palazzo Stone",
        precioVenta: 49900,
        imagenUrl:
          "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&q=80",
        stockDisponibleUnits: 5,
        categoriaId: 2,
        subcategoriaId: 21,
        categoria: { id: 2, nombre: "Pantalones" },
      },
      {
        id: 3,
        nombre: "Hoodie Oversize Washed",
        precioVenta: 38900,
        imagenUrl:
          "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&q=80",
        stockDisponibleUnits: 3,
        categoriaId: 1,
        subcategoriaId: 12,
        categoria: { id: 1, nombre: "Remeras" },
      },
      {
        id: 4,
        nombre: "Gorra Structured Cap",
        precioVenta: 14900,
        imagenUrl:
          "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80",
        stockDisponibleUnits: 11,
        categoriaId: 3,
        subcategoriaId: 31,
        categoria: { id: 3, nombre: "Accesorios" },
      },
      {
        id: 5,
        nombre: "Zapatillas Urban Flex",
        precioVenta: 62900,
        imagenUrl:
          "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80",
        stockDisponibleUnits: 7,
        categoriaId: 4,
        subcategoriaId: 41,
        categoria: { id: 4, nombre: "Calzado" },
      },
      {
        id: 6,
        nombre: "Remera Básica Negro",
        precioVenta: 9900,
        imagenUrl:
          "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&q=80",
        stockDisponibleUnits: 22,
        categoriaId: 1,
        subcategoriaId: 11,
        categoria: { id: 1, nombre: "Remeras" },
      },
      {
        id: 7,
        nombre: "Cinturón Cuero Genuino",
        precioVenta: 24900,
        imagenUrl:
          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80",
        stockDisponibleUnits: 4,
        categoriaId: 3,
        subcategoriaId: 32,
        categoria: { id: 3, nombre: "Accesorios" },
      },
      {
        id: 8,
        nombre: "Jogger Cargo Tape",
        precioVenta: 35900,
        imagenUrl:
          "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&q=80",
        stockDisponibleUnits: 9,
        categoriaId: 2,
        subcategoriaId: 22,
        categoria: { id: 2, nombre: "Pantalones" },
      },
    ],
    [],
  );

  // Filtrar
  const filteredProducts = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.nombre.toLowerCase().includes(q)) return false;
      if (selectedCategory && p.categoriaId !== selectedCategory) return false;
      if (selectedSubcategory && p.subcategoriaId !== selectedSubcategory)
        return false;
      return true;
    });
  }, [products, searchTerm, selectedCategory, selectedSubcategory]);

  // Agrupar por categoría
  const productsByCategory = React.useMemo(() => {
    return categories
      .map((cat) => ({
        category: cat,
        products: filteredProducts.filter((p) => p.categoriaId === cat.id),
      }))
      .filter((s) => s.products.length > 0);
  }, [categories, filteredProducts]);

  const hasActiveFilter = Boolean(searchTerm || selectedCategory);

  // Block styles
  const blockStyles: Record<string, string> = {};
  if (branding.primaryColor)
    blockStyles["--store-primary"] = branding.primaryColor;
  if (branding.secondaryColor)
    blockStyles["--store-secondary"] = branding.secondaryColor;

  return (
    <div
      className={cn(
        "w-full h-full flex flex-col relative overflow-hidden store-theme-root",
        isMobile && "preview-mobile-sim",
      )}
      style={{
        ...blockStyles,
        fontFamily: mergedConfig.typography
          ? `"${mergedConfig.typography}", sans-serif`
          : undefined,
      }}
    >
      {/* Device Chrome */}
      {isMobile && (
        <div
          className={cn("shrink-0 bg-card/95 backdrop-blur-sm", pageBgClass)}
        >
          <MobileStatusBar />
        </div>
      )}
      {!isMobile && (
        <DesktopBrowserBar storeName={mergedConfig.businessName ?? undefined} />
      )}

      {/* ─── Scrollable Store Content ─── */}
      <div
        className={cn("flex-1 overflow-y-auto overflow-x-hidden", pageBgClass)}
        style={{ scrollBehavior: "smooth" }}
      >
        <StoreHeader
          config={mergedConfig}
          cartCount={2}
          onOpenCart={() => {}}
        />

        <div
          className={cn(!isMobile && "max-w-screen-2xl mx-auto px-0 lg:px-6")}
        >
          <div className={cn(!isMobile && "flex gap-6 items-start")}>
            {/* Desktop Sidebar */}
            {!isMobile && (
              <div className="hidden lg:block pt-6">
                <DesktopCategorySidebar
                  categories={categories}
                  allProducts={products}
                  selectedCategory={selectedCategory}
                  selectedSubcategory={selectedSubcategory}
                  onSelectCategory={(id) => {
                    setSelectedCategory(id);
                    setSelectedSubcategory(null);
                  }}
                  onSelectSubcategory={setSelectedSubcategory}
                  totalProducts={products.length}
                />
              </div>
            )}

            <div className="flex-1 min-w-0 pb-24 lg:pb-10">
              {/* SearchBar */}
              <div
                className={cn("px-4 pt-4 pb-2", isMobile ? "" : "pt-6 pb-3")}
              >
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder={`Buscar en ${mergedConfig.businessName || "la tienda"}...`}
                />
              </div>

              {/* CategoryTabs (mobile only) */}
              {isMobile && (
                <CategoryTabs
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={(id) => {
                    setSelectedCategory(id);
                    setSelectedSubcategory(null);
                  }}
                  allProducts={products}
                  className="mt-2"
                />
              )}

              {/* Productos */}
              <div className="mt-4 space-y-8">
                {hasActiveFilter ? (
                  <ProductSection
                    title={
                      searchTerm
                        ? `"${searchTerm}"`
                        : categories.find((c) => c.id === selectedCategory)
                            ?.nombre || "Productos"
                    }
                    count={filteredProducts.length}
                    products={filteredProducts}
                    config={mergedConfig}
                    viewMode="grid"
                    isConsigne={false}
                    onAddToCart={() => {}}
                    onViewProduct={() => {}}
                    forceGrid
                  />
                ) : (
                  productsByCategory.map(
                    ({ category, products: catProducts }) => (
                      <ProductSection
                        key={category.id}
                        title={category.nombre}
                        count={catProducts.length}
                        products={catProducts}
                        config={mergedConfig}
                        viewMode="grid"
                        isConsigne={false}
                        onAddToCart={() => {}}
                        onViewProduct={() => {}}
                        onViewAll={() => setSelectedCategory(category.id)}
                        forceGrid
                      />
                    ),
                  )
                )}
              </div>

              {/* Footer */}
              <div className="mt-12">
                <StoreFooter config={mergedConfig} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
