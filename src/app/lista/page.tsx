/* eslint-disable */
// @ts-nocheck

"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { apiService } from "@/lib/apiService";

// Importación de componentes refactorizados
import { StoreHeader } from "./components/store-header";
import { StoreBanner } from "./components/store-banner";
import { StoreFilters } from "./components/store-filters";
import { ProductList } from "./components/product-list";
import { StoreFooter } from "./components/store-footer";
import { CartDrawer } from "./components/cart-drawer";
// 👇 IMPORTANTE: Asegúrate de tener este componente creado
import { ProductModal } from "./components/product-modal";
import { getThemeStyles } from "./lib/theme-utils";
import { StoreCategorySidebar } from "./components/store-category-sidebar";

function CatalogContent() {
    const searchParams = useSearchParams();
    const sucursalId = searchParams.get("sucursalId");

    // --- Estados de Datos ---
    const [data, setData] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // --- Estados de UI/Filtros ---
    const [searchTerm, setSearchTerm] = React.useState("");
    const [selectedCategory, setSelectedCategory] = React.useState<number | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = React.useState<number | null>(null);
    const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
    const [isConsigne, setIsConsigne] = React.useState(false);
    const [selectedProduct, setSelectedProduct] = React.useState<any>(null);
    const [sortBy, setSortBy] = React.useState("relevance"); // Nuevo estado para ordenar

    // --- Estados del Carrito ---
    const [cart, setCart] = React.useState<any[]>([]);
    const [isCartOpen, setIsCartOpen] = React.useState(false);
    const [checkoutLoading, setCheckoutLoading] = React.useState(false);

    // --- Fetch Data ---
    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiService.getPublicListaPrecios(sucursalId ? Number(sucursalId) : undefined);
                setData(res);
            } catch (err: any) {
                setError(err.message || "Error al cargar el catálogo");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [sucursalId]);

    // --- Configuración e Inyección de Estilos ---
    const config = data?.config || {};
    const { theme, pageBgClass } = getThemeStyles(config.themeIdentifier);

    React.useEffect(() => {
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "0, 0, 0";
        };

        const getContrastColor = (hex: string) => {
            const rgb = hexToRgb(hex).split(',').map(n => parseInt(n));
            const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
            return brightness > 155 ? '#000000' : '#ffffff';
        };

        if (config.primaryColor) {
            document.documentElement.style.setProperty('--primary', config.primaryColor);
            document.documentElement.style.setProperty('--primary-rgb', hexToRgb(config.primaryColor));
            document.documentElement.style.setProperty('--primary-foreground', getContrastColor(config.primaryColor));
        }
        if (config.secondaryColor) {
            document.documentElement.style.setProperty('--secondary', config.secondaryColor);
            document.documentElement.style.setProperty('--secondary-foreground', getContrastColor(config.secondaryColor));
        }

        // --- Inyección Dinámica de Google Fonts ---
        if (config.typography) {
            const fontName = config.typography;
            const linkId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;

            if (!document.getElementById(linkId)) {
                const link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&display=swap`;
                document.head.appendChild(link);
            }
        }
    }, [config.primaryColor, config.secondaryColor, config.typography]);

    // --- Lógica del Carrito ---
    // 👇 Modificado para recibir "quantity" desde el Modal
    const addToCart = (product: any, quantity: number = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
            }
            return [...prev, { ...product, quantity: quantity }];
        });
        toast.success(`${product.nombre} añadido al carrito`);
    };

    const removeFromCart = (id: number) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const updateQuantity = (id: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const handleCheckout = async (clienteData: any, envioData: any) => {
        setCheckoutLoading(true);
        try {
            const res = await apiService.createPublicCheckout({
                items: cart,
                sucursalId: sucursalId ? Number(sucursalId) : 1,
                clienteData,
                envioData
            });
            if (res?.init_point) {
                window.location.href = res.init_point;
            } else if (res?.data?.init_point) {
                window.location.href = res.data.init_point;
            } else {
                toast.error("No se pudo obtener el link de pago");
            }
        } catch (err: any) {
            toast.error(err.message || "Error al iniciar el pago");
        } finally {
            setCheckoutLoading(false);
        }
    };

    // --- Render Loading/Error ---
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Loader2 className="h-10 w-10 text-neutral-900" />
                </motion.div>
                <p className="mt-4 text-neutral-500 animate-pulse font-medium">Cargando catálogo exclusivo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center text-neutral-900">
                <div className="bg-destructive/10 p-4 rounded-full mb-4">
                    <XCircle className="h-12 w-12 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Ops!</h1>
                <p className="text-neutral-500 max-w-md">{error}</p>
                <Button variant="outline" className="mt-6 border-neutral-200" onClick={() => window.location.reload()}>Reintentar</Button>
            </div>
        );
    }

    // --- Motor de Filtrado y Ordenamiento Avanzado (E-commerce Style) ---
    const filteredProducts = (() => {
        if (!data?.productos) return [];

        // 1. Filtrar por búsqueda y categoría/subcategoría
        const result = data.productos.filter((p: any) => {
            const matchesSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());

            // Si hay subcategoría seleccionada, filtramos estrictamente por ella
            if (selectedSubcategory) {
                return matchesSearch && p.subcategoriaId === selectedSubcategory;
            }

            // Si no hay subcategoría pero sí categoría, filtramos por la categoría
            const matchesCategory = !selectedCategory || p.categoriaId === selectedCategory;
            return matchesSearch && matchesCategory;
        });

        // 2. Ordenar resultados
        switch (sortBy) {
            case "price_asc":
                result.sort((a: any, b: any) => Number(a.precioVenta) - Number(b.precioVenta));
                break;
            case "price_desc":
                result.sort((a: any, b: any) => Number(b.precioVenta) - Number(a.precioVenta));
                break;
            case "name_asc":
                result.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));
                break;
            case "name_desc":
                result.sort((a: any, b: any) => b.nombre.localeCompare(a.nombre));
                break;
            default: // relevance (orden original)
                break;
        }

        return result;
    })();

    return (
        <div
            className={cn(
                "min-h-screen selection:bg-neutral-900 selection:text-white transition-colors duration-500 store-theme-root",
                pageBgClass
            )}
            style={{ fontFamily: config.typography ? `"${config.typography}", sans-serif` : undefined }}
        >
            <StoreHeader
                config={config}
                cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
                onOpenCart={() => setIsCartOpen(true)}
            />

            <main className="container mx-auto px-3 sm:px-5 md:px-8 py-5 md:py-10 flex flex-col gap-5 sm:gap-8 min-h-[60vh]">
                <StoreBanner config={config} />

                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start relative w-full">
                    <StoreCategorySidebar
                        config={config}
                        categories={data?.categorias || []}
                        categoryCounts={data?.productos?.reduce((acc: any, product: any) => {
                            const catId = product.categoriaId;
                            acc[catId] = (acc[catId] || 0) + 1;
                            return acc;
                        }, {}) || {}}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={(id) => {
                            setSelectedCategory(id);
                            setSelectedSubcategory(null); // Reset subcategory when category changes
                        }}
                        selectedSubcategory={selectedSubcategory}
                        setSelectedSubcategory={setSelectedSubcategory}
                        totalProducts={data?.productos?.length || 0}
                        allProducts={data?.productos || []}
                    />

                    <div className="flex-1 flex flex-col gap-5 sm:gap-8 min-w-0 w-full">
                        <StoreFilters
                            config={config}
                            products={data?.productos || []}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            viewMode={viewMode}
                            setViewMode={setViewMode}
                            categories={data?.categorias || []}
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

                        <ProductList
                            products={filteredProducts}
                            config={config}
                            onViewProduct={(product) => setSelectedProduct(product)}
                            viewMode={viewMode}
                            isConsigne={isConsigne}
                            onAddToCart={addToCart}
                        />
                    </div>
                </div>
            </main>

            <StoreFooter config={config} />

            <div className="pb-8 sm:pb-10 px-4">
                <div className="mx-auto max-w-3xl flex justify-center">
                    <Button asChild variant="outline" className="rounded-xl px-5">
                        <a href="/login">Ir al panel de login</a>
                    </Button>
                </div>
            </div>

            <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                cart={cart}
                config={config}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
                onCheckout={handleCheckout}
                loading={checkoutLoading}
            />

            {/* 👇 NUEVO: Componente del Modal para Ver Detalles */}
            <ProductModal
                isOpen={!!selectedProduct}
                product={selectedProduct}
                onClose={() => setSelectedProduct(null)}
                config={config}
                isConsigne={isConsigne}
                onAddToCart={addToCart}
            />
        </div>
    );
}

export default function PublicCatalogPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-white p-6">
                <Loader2 className="h-10 w-10 text-neutral-900 animate-spin" />
            </div>
        }>
            <CatalogContent />
        </React.Suspense>
    )
}
