import * as React from "react";
import { cn } from "@/lib/utils";

// Componentes Reales del Catálogo
import { StoreHeader } from "@/app/lista/components/store-header";
import { StoreBanner } from "@/app/lista/components/store-banner";
import { StoreFilters } from "@/app/lista/components/store-filters";
import { ProductList } from "@/app/lista/components/product-list";
import { StoreFooter } from "@/app/lista/components/store-footer";
import { StoreCategorySidebar } from "@/app/lista/components/store-category-sidebar";
import { StorefrontSections } from "@/app/lista/components/storefront-sections";
import { getThemeStyles } from "@/app/lista/lib/theme-utils";
import type { PublicCatalogSortBy } from "@/lib/types";
import type { BrandingPreviewSettings, StoreLayoutConfig, StoreLayoutMode } from "./types";

type PreviewProduct = {
    id: number;
    nombre: string;
    precioVenta: number;
    costoConsignacion?: number;
    imagenUrl: string;
    stockDisponibleUnits: number;
    categoriaId: number;
    subcategoriaId: number | null;
    categoria?: { id: number; nombre: string };
};

type PreviewCategory = {
    id: number;
    nombre: string;
    negocioId: number;
    subcategorias: Array<{ id: number; nombre: string }>;
};

type StorePreviewProps = {
    branding: BrandingPreviewSettings;
    config: StoreLayoutConfig;
    mode: "mobile" | "desktop";
};

// ─── Simulated Status Bar (Mobile) ───
function MobileStatusBar() {
    const [time, setTime] = React.useState(() => {
        const now = new Date();
        return `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
    });

    React.useEffect(() => {
        const id = setInterval(() => {
            const now = new Date();
            setTime(`${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`);
        }, 30_000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="relative z-20 flex items-center justify-between px-7 pt-[14px] pb-1 text-[11px] font-semibold text-foreground/80 select-none"
            style={{ fontFamily: '-apple-system, "SF Pro Text", sans-serif' }}
        >
            <span className="w-14 text-left tracking-tight">{time}</span>

            {/* Dynamic Island placeholder — occupies center space */}
            <div className="w-[100px]" />

            {/* Right cluster: signal + wifi + battery */}
            <div className="flex items-center gap-[5px] w-14 justify-end">
                {/* Cellular bars */}
                <svg width="15" height="11" viewBox="0 0 15 11" fill="none" className="opacity-80">
                    <rect x="0" y="8" width="2.5" height="3" rx="0.5" fill="currentColor" />
                    <rect x="3.5" y="5.5" width="2.5" height="5.5" rx="0.5" fill="currentColor" />
                    <rect x="7" y="3" width="2.5" height="8" rx="0.5" fill="currentColor" />
                    <rect x="10.5" y="0" width="2.5" height="11" rx="0.5" fill="currentColor" />
                </svg>

                {/* WiFi */}
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="opacity-80">
                    <path d="M7 9.5a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z" fill="currentColor" />
                    <path d="M4.2 6.7a3.8 3.8 0 015.6 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M2 4.2a7 7 0 0110 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>

                {/* Battery */}
                <svg width="22" height="11" viewBox="0 0 22 11" fill="none" className="opacity-80">
                    <rect x="0.5" y="0.5" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1" />
                    <rect x="2" y="2" width="14" height="7" rx="1" fill="currentColor" />
                    <path d="M20 3.5v4a1.5 1.5 0 000-4z" fill="currentColor" opacity="0.4" />
                </svg>
            </div>
        </div>
    );
}

// ─── Simulated Browser Bar (Desktop) ───
function DesktopBrowserBar({ storeName }: { storeName?: string }) {
    const slug = (storeName || "tu-tienda")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

    return (
        <div className="relative z-20 flex items-center gap-2.5 px-3.5 py-2 bg-muted/90 border-b border-border/60 select-none shrink-0">
            {/* Traffic lights */}
            <div className="flex items-center gap-[6px] shrink-0">
                <span className="h-[10px] w-[10px] rounded-full bg-[color:var(--traffic-red)] shadow-sm" />
                <span className="h-[10px] w-[10px] rounded-full bg-[color:var(--traffic-yellow)] shadow-sm" />
                <span className="h-[10px] w-[10px] rounded-full bg-[color:var(--traffic-green)] shadow-sm" />
            </div>

            {/* URL bar */}
            <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-1.5 bg-card/80 border border-border/80 rounded-md px-3 py-[3px] text-[11px] max-w-[260px] w-full justify-center">
                    {/* Lock icon */}
                    <svg width="9" height="10" viewBox="0 0 9 10" fill="none" className="text-muted-foreground/80 shrink-0">
                        <rect x="0.5" y="4" width="8" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1" />
                        <path d="M2.5 4V2.8a2 2 0 014 0V4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    <span className="text-muted-foreground truncate">{slug}.consignacion.app</span>
                </div>
            </div>

            {/* Spacer to balance traffic lights */}
            <div className="w-[52px] shrink-0" />
        </div>
    );
}

// ─── Main Component ───
export function StorePreviewArea({ branding, config, mode }: StorePreviewProps) {
    const isMobile = mode === "mobile";

    const mergedConfig = { sucursalId: 1, ...config, ...branding };
    const { pageBgClass } = getThemeStyles(mergedConfig.themeIdentifier);

    const cssColorToRgb = (color: string) => {
        const normalized = (color || "").trim();
        const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;

        if (hex.length === 3) {
            const expanded = hex.split("").map((char) => char + char).join("");
            const int = Number.parseInt(expanded, 16);
            return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
        }

        if (hex.length === 6) {
            const int = Number.parseInt(hex, 16);
            return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
        }

        return "0, 0, 0";
    };

    const getContrastColor = (color: string) => {
        const rgb = cssColorToRgb(color).split(",").map((n) => parseInt(n));
        const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
        return brightness > 155 ? "hsl(var(--foreground))" : "hsl(var(--background))";
    };

    const blockStyles = {
        "--primary": mergedConfig.primaryColor || "hsl(var(--primary))",
        "--primary-rgb": cssColorToRgb(mergedConfig.primaryColor || "hsl(var(--primary))"),
        "--primary-foreground": getContrastColor(mergedConfig.primaryColor || "hsl(var(--primary))"),
        "--secondary": mergedConfig.secondaryColor || "hsl(var(--secondary))",
        "--secondary-foreground": getContrastColor(mergedConfig.secondaryColor || "hsl(var(--secondary))"),
    } as React.CSSProperties;

    const [searchTerm, setSearchTerm] = React.useState("");
    const [selectedCategory, setSelectedCategory] = React.useState<number | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = React.useState<number | null>(null);
    const [viewMode, setViewMode] = React.useState<StoreLayoutMode>(mergedConfig.tiendaLayout || "grid");
    const [isConsigne, setIsConsigne] = React.useState(false);
    const [sortBy, setSortBy] = React.useState<PublicCatalogSortBy>("relevance");

    React.useEffect(() => {
        setViewMode(mergedConfig.tiendaLayout || "grid");
    }, [mergedConfig.tiendaLayout]);

    React.useEffect(() => {
        if (!selectedCategory) {
            setSelectedSubcategory(null);
        }
    }, [selectedCategory]);

    const categories = React.useMemo<PreviewCategory[]>(() => [
        { id: 1, nombre: "Remeras", negocioId: 1, subcategorias: [{ id: 11, nombre: "Basicas" }, { id: 12, nombre: "Oversize" }] },
        { id: 2, nombre: "Pantalones", negocioId: 1, subcategorias: [{ id: 21, nombre: "Jean" }, { id: 22, nombre: "Sastrero" }] },
        { id: 3, nombre: "Accesorios", negocioId: 1, subcategorias: [{ id: 31, nombre: "Gorras" }] },
        { id: 4, nombre: "Zapatillas", negocioId: 1, subcategorias: [] },
    ], []);

    const products = React.useMemo<PreviewProduct[]>(() => [
        {
            id: 1,
            nombre: "Remera Relaxed Fit",
            precioVenta: 24900,
            costoConsignacion: 16500,
            imagenUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80",
            stockDisponibleUnits: 8,
            categoriaId: 1,
            subcategoriaId: 11,
            categoria: { id: 1, nombre: "Remeras" },
        },
        {
            id: 2,
            nombre: "Jean Palazzo Stone",
            precioVenta: 49900,
            costoConsignacion: 32000,
            imagenUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&q=80",
            stockDisponibleUnits: 5,
            categoriaId: 2,
            subcategoriaId: 21,
            categoria: { id: 2, nombre: "Pantalones" },
        },
        {
            id: 3,
            nombre: "Hoodie Oversize Washed",
            precioVenta: 38900,
            costoConsignacion: 24000,
            imagenUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&q=80",
            stockDisponibleUnits: 3,
            categoriaId: 1,
            subcategoriaId: 12,
            categoria: { id: 1, nombre: "Remeras" },
        },
        {
            id: 4,
            nombre: "Gorra Structured Cap",
            precioVenta: 14900,
            costoConsignacion: 8500,
            imagenUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80",
            stockDisponibleUnits: 11,
            categoriaId: 3,
            subcategoriaId: 31,
            categoria: { id: 3, nombre: "Accesorios" },
        },
    ], []);

    const filteredProducts = React.useMemo(() => {
        const result = products.filter((p) => {
            const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !selectedCategory || p.categoriaId === selectedCategory;
            const matchesSubcategory = !selectedSubcategory || p.subcategoriaId === selectedSubcategory;
            const matchesConsigne = !isConsigne || typeof p.costoConsignacion === "number";
            return matchesSearch && matchesCategory && matchesSubcategory && matchesConsigne;
        });

        result.sort((a, b) => {
            switch (sortBy) {
                case "price_asc":
                    return a.precioVenta - b.precioVenta;
                case "price_desc":
                    return b.precioVenta - a.precioVenta;
                case "name_asc":
                    return a.nombre.localeCompare(b.nombre);
                case "name_desc":
                    return b.nombre.localeCompare(a.nombre);
                default:
                    return 0;
            }
        });

        return result;
    }, [products, isConsigne, searchTerm, selectedCategory, selectedSubcategory, sortBy]);

    React.useEffect(() => {
        if (mergedConfig.typography) {
            const fontName = mergedConfig.typography;
            const linkId = `preview-google-font-${fontName.replace(/\s+/g, "-").toLowerCase()}`;

            if (!document.getElementById(linkId)) {
                const link = document.createElement("link");
                link.id = linkId;
                link.rel = "stylesheet";
                link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, "+")}:wght@300;400;500;600;700;800;900&display=swap`;
                document.head.appendChild(link);
            }
        }
    }, [mergedConfig.typography]);

    return (
        <div
            className={cn(
                "w-full h-full flex flex-col relative overflow-hidden store-theme-root",
                isMobile && "preview-mobile-sim"
            )}
            style={{
                ...blockStyles,
                fontFamily: mergedConfig.typography ? `"${mergedConfig.typography}", sans-serif` : undefined,
            }}
        >
            {/* ─── Device Chrome ─── */}

            {/* Mobile: Status bar (renders above content, below the parent's notch) */}
            {isMobile && (
                <div className={cn("shrink-0 bg-card/95 backdrop-blur-sm", pageBgClass)}>
                    <MobileStatusBar />
                </div>
            )}

            {/* Desktop: Browser bar */}
            {!isMobile && (
                <DesktopBrowserBar storeName={mergedConfig.storeName || mergedConfig.nombreTienda} />
            )}

            {/* ─── Scrollable Store Content ─── */}
            <div
                className={cn(
                    "flex-1 overflow-y-auto overflow-x-hidden transition-colors duration-500",
                    pageBgClass
                )}
                style={{ scrollBehavior: "smooth" }}
            >
                <StoreHeader
                    config={mergedConfig}
                    cartCount={2}
                    onOpenCart={() => {}}
                    categories={categories}
                    onSelectCategory={(id) => setSelectedCategory(id)}
                />

                <main
                    className={cn(
                        "container mx-auto flex flex-col",
                        isMobile ? "px-3 py-4 gap-4" : "px-4 md:px-8 py-8 gap-6"
                    )}
                >
                    <StoreBanner
                        config={mergedConfig}
                        productsCount={products.length}
                        categoriesCount={categories.length}
                        onPrimaryAction={() => setSelectedCategory(null)}
                        onSecondaryAction={() => setSelectedCategory(categories[0]?.id ?? null)}
                    />

                    <StorefrontSections
                        config={mergedConfig}
                        products={products}
                        categories={categories}
                        onSelectCategory={(id) => setSelectedCategory(id)}
                        onScrollToCatalog={() => {}}
                        onOpenProduct={() => {}}
                        onAddToCart={() => {}}
                        isConsigne={isConsigne}
                    />

                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start relative w-full">
                        <StoreCategorySidebar
                            config={mergedConfig}
                            categories={categories}
                            categoryCounts={products.reduce<Record<number, number>>((acc, product) => {
                                acc[product.categoriaId] = (acc[product.categoriaId] || 0) + 1;
                                return acc;
                            }, {})}
                            selectedCategory={selectedCategory}
                            setSelectedCategory={(id) => {
                                setSelectedCategory(id);
                                setSelectedSubcategory(null);
                            }}
                            selectedSubcategory={selectedSubcategory}
                            setSelectedSubcategory={setSelectedSubcategory}
                            totalProducts={products.length}
                            allProducts={products}
                        />

                        <div className="flex-1 flex flex-col gap-5 sm:gap-8 min-w-0 w-full">
                            <StoreFilters
                                config={mergedConfig}
                                products={products}
                                visibleCount={filteredProducts.length}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                categories={categories}
                                selectedCategory={selectedCategory}
                                setSelectedCategory={(id) => {
                                    setSelectedCategory(id);
                                    setSelectedSubcategory(null);
                                }}
                                selectedSubcategory={selectedSubcategory}
                                setSelectedSubcategory={setSelectedSubcategory}
                                isConsigne={isConsigne}
                                setIsConsigne={setIsConsigne}
                                sortBy={sortBy}
                                setSortBy={setSortBy}
                            />

                            <div className={isMobile ? "preview-mobile-product-list" : undefined}>
                                <ProductList
                                    products={filteredProducts}
                                    config={mergedConfig}
                                    onViewProduct={() => {}}
                                    viewMode={viewMode}
                                    isConsigne={isConsigne}
                                    onAddToCart={() => {}}
                                />
                            </div>
                        </div>
                    </div>
                </main>

                <StoreFooter config={mergedConfig} />

                {/* Bottom breathing room */}
                <div className="h-16" />
            </div>

            {/* ─── Device Frame Overlay (single subtle ring + soft inner shadow) ─── */}
            <div
                className={cn(
                    "pointer-events-none absolute inset-0 z-50",
                    isMobile
                        ? "rounded-[2.5rem] ring-1 ring-inset ring-border/60 shadow-inner"
                        : "rounded-xl ring-1 ring-inset ring-border/50"
                )}
            />

            {isMobile && (
                <style jsx global>{`
                    .preview-mobile-sim .preview-mobile-product-list > div {
                        grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
                        gap: 0.75rem !important;
                    }

                    .preview-mobile-sim .preview-mobile-product-list > div > * {
                        min-width: 0;
                    }
                `}</style>
            )}
        </div>
    );
}
