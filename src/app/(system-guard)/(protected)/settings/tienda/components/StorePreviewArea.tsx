/* eslint-disable */
// @ts-nocheck
 
import * as React from "react";
import { cn } from "@/lib/utils";

// Componentes Reales del Catálogo
import { StoreHeader } from "@/app/lista/components/store-header";
import { StoreBanner } from "@/app/lista/components/store-banner";
import { StoreFilters } from "@/app/lista/components/store-filters";
import { ProductList } from "@/app/lista/components/product-list";
import { StoreFooter } from "@/app/lista/components/store-footer";

export function StorePreviewArea({ branding, config, mode }: any) {
    // 1. Fusionamos todo en un único "config" como lo espera el catálogo público
    const mergedConfig = { ...config, ...branding };
    const theme = mergedConfig.themeIdentifier || "modern";

    // 2. Variables CSS dinámicas locales al scope del preview para no pisar el panel de admin
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#000000");
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "0, 0, 0";
    };

    const getContrastColor = (hex: string) => {
        const rgb = hexToRgb(hex).split(',').map(n => parseInt(n));
        const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
        return brightness > 155 ? '#000000' : '#ffffff';
    };

    const blockStyles = {
        '--primary': mergedConfig.primaryColor || '#000000',
        '--primary-rgb': hexToRgb(mergedConfig.primaryColor || '#000000'),
        '--primary-foreground': getContrastColor(mergedConfig.primaryColor || '#000000'),
        '--secondary': mergedConfig.secondaryColor || '#3b82f6',
        '--secondary-foreground': getContrastColor(mergedConfig.secondaryColor || '#3b82f6'),
    } as React.CSSProperties;

    // 3. Estados simulados para que la interfaz se mueva y sea interactiva
    const [searchTerm, setSearchTerm] = React.useState("");
    const [selectedCategory, setSelectedCategory] = React.useState<number | null>(null);
    const [viewMode, setViewMode] = React.useState<"grid" | "list">(mergedConfig.tiendaLayout || "grid");
    const [isConsigne, setIsConsigne] = React.useState(false);
    const [sortBy, setSortBy] = React.useState("relevance");

    // Sincronizar el modo de vista por defecto si cambia en las opciones
    React.useEffect(() => {
        setViewMode(mergedConfig.tiendaLayout || "grid");
    }, [mergedConfig.tiendaLayout]);

    // 4. Datos Simulados Refinados
    const categories = [
        { id: 1, nombre: 'Remeras', negocioId: 1 },
        { id: 2, nombre: 'Pantalones', negocioId: 1 },
        { id: 3, nombre: 'Accesorios', negocioId: 1 },
        { id: 4, nombre: 'Zapatillas', negocioId: 1 },
    ];

    const products = [
        {
            id: 1,
            nombre: "Remera Oversize Essentials",
            precioVenta: 15000,
            costoConsignacion: 10000,
            imagenUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80",
            categoriaId: 1
        },
        {
            id: 2,
            nombre: "Jean Wide Leg Vintage",
            precioVenta: 35000,
            costoConsignacion: 20000,
            imagenUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&q=80",
            categoriaId: 2
        },
        {
            id: 3,
            nombre: "Buzo Canguro Premium",
            precioVenta: 25000,
            costoConsignacion: 15000,
            imagenUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&q=80",
            categoriaId: 1
        },
        {
            id: 4,
            nombre: "Cap Minimalist",
            precioVenta: 8500,
            costoConsignacion: 4000,
            imagenUrl: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80",
            categoriaId: 3
        },
    ];

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !selectedCategory || p.categoriaId === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    React.useEffect(() => {
        if (mergedConfig.typography) {
            const fontName = mergedConfig.typography;
            const linkId = `preview-google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;

            if (!document.getElementById(linkId)) {
                const link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&display=swap`;
                document.head.appendChild(link);
            }
        }
    }, [mergedConfig.typography]);

    const pageBgClass = cn(
        theme === 'minimal' ? "bg-white" : "bg-neutral-50",
        (mergedConfig.primaryColor === '#ffffff' || mergedConfig.primaryColor === 'white') ? "bg-white" : ""
    );

    return (
        <div
            className="w-full h-full flex flex-col relative overflow-hidden store-theme-root"
            style={{
                ...blockStyles,
                fontFamily: mergedConfig.typography ? `"${mergedConfig.typography}", sans-serif` : undefined
            }}
        >
            <div className={cn(
                "w-full h-full overflow-y-auto overflow-x-hidden scrollbar-hide absolute inset-0 transition-colors duration-500",
                pageBgClass
            )}>
                {/* 5. Inyección de los Componentes Reales */}
                <StoreHeader
                    config={mergedConfig}
                    cartCount={2}
                    onOpenCart={() => { }}
                />

                <main className="container mx-auto px-4 md:px-8 py-8 flex flex-col gap-6">
                    <StoreBanner config={mergedConfig} />

                    <StoreFilters
                        config={mergedConfig}
                        products={products}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        categories={categories}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        isConsigne={isConsigne}
                        setIsConsigne={setIsConsigne}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                    />

                    <ProductList
                        products={filteredProducts}
                        config={mergedConfig}
                        onViewProduct={() => { }}
                        viewMode={viewMode}
                        isConsigne={isConsigne}
                        onAddToCart={() => { }}
                    />
                </main>

                <StoreFooter config={mergedConfig} />

                {/* Espacio para que el scroll termine de llegar al final */}
                <div className="h-20 bg-transparent"></div>
            </div>

            {/* Overlay para "Efecto Dispositivo Apple" */}
            <div className="pointer-events-none absolute inset-0 z-50 rounded-[3rem] ring-1 ring-inset ring-black/5 dark:ring-white/10" />
            <div className="pointer-events-none absolute inset-[4px] z-50 rounded-[2.8rem] ring-1 ring-inset ring-black/10 dark:ring-white/5" />
        </div>
    );
}
