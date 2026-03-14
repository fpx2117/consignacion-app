/* eslint-disable */
// @ts-nocheck

"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
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
import { getThemeStyles } from "./lib/theme-utils";
import { StoreCategorySidebar } from "./components/store-category-sidebar";

const CartDrawer = dynamic(
  () => import("./components/cart-drawer").then((m) => m.CartDrawer),
  { ssr: false }
);

const ProductModal = dynamic(
  () => import("./components/product-modal").then((m) => m.ProductModal),
  { ssr: false }
);

const CHECKOUT_TOKEN_STORAGE_KEY = "public_checkout_token_v2";
const CHECKOUT_POLL_INTERVAL_MS = 2000;
const CHECKOUT_POLL_TIMEOUT_MS = 90000;

type CheckoutFeedbackState = {
    kind: "polling" | "success" | "error";
    message: string;
};

type StoredCheckoutToken = {
    token: string;
    sucursalId: number;
    createdAt: number;
};

export function CatalogClient({
    initialData,
    initialError = null,
    sucursalId,
    checkoutReturnStatus,
}: {
    initialData: any | null;
    initialError?: string | null;
    sucursalId: number | null;
    checkoutReturnStatus: string | null;
}) {
    // --- Estados de Datos ---
    const [data, setData] = React.useState<any>(initialData);
    const [loading, setLoading] = React.useState(!initialData && !initialError);
    const [error, setError] = React.useState<string | null>(initialError);

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
    const [checkoutFeedback, setCheckoutFeedback] = React.useState<CheckoutFeedbackState | null>(null);

    const handledReturnRef = React.useRef<string | null>(null);

    const getSucursalIdForCheckout = React.useCallback(() => {
        return sucursalId ?? 1;
    }, [sucursalId]);

    const saveCheckoutToken = React.useCallback((token: string, storeSucursalId: number) => {
        if (typeof window === "undefined") return;
        const payload: StoredCheckoutToken = {
            token,
            sucursalId: storeSucursalId,
            createdAt: Date.now(),
        };
        window.localStorage.setItem(CHECKOUT_TOKEN_STORAGE_KEY, JSON.stringify(payload));
    }, []);

    const clearCheckoutToken = React.useCallback(() => {
        if (typeof window === "undefined") return;
        window.localStorage.removeItem(CHECKOUT_TOKEN_STORAGE_KEY);
    }, []);

    const readCheckoutToken = React.useCallback((storeSucursalId: number): string | null => {
        if (typeof window === "undefined") return null;

        const raw = window.localStorage.getItem(CHECKOUT_TOKEN_STORAGE_KEY);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw) as StoredCheckoutToken;
            const expired = Date.now() - Number(parsed.createdAt || 0) > 24 * 60 * 60 * 1000;
            const mismatchedSucursal = Number(parsed.sucursalId) !== Number(storeSucursalId);

            if (!parsed.token || expired || mismatchedSucursal) {
                window.localStorage.removeItem(CHECKOUT_TOKEN_STORAGE_KEY);
                return null;
            }

            return parsed.token;
        } catch {
            window.localStorage.removeItem(CHECKOUT_TOKEN_STORAGE_KEY);
            return null;
        }
    }, []);

    // --- Fetch Data ---
    React.useEffect(() => {
        if (initialData || initialError) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const res = await apiService.getPublicListaPrecios(sucursalId ?? undefined);
                setData(res);
            } catch (err: any) {
                setError(err.message || "Error al cargar el catálogo");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [initialData, initialError, sucursalId]);

    // --- Configuración e Inyección de Estilos ---
    const config = data?.config || {};
    const { theme, pageBgClass } = getThemeStyles(config.themeIdentifier);
    const products = React.useMemo(() => data?.productos || [], [data?.productos]);
    const categories = React.useMemo(() => data?.categorias || [], [data?.categorias]);
    const deferredSearchTerm = React.useDeferredValue(searchTerm);

    const categoryCounts = React.useMemo(() => {
        return products.reduce((acc: any, product: any) => {
            const catId = product.categoriaId;
            acc[catId] = (acc[catId] || 0) + 1;
            return acc;
        }, {});
    }, [products]);

    const cartCount = React.useMemo(
        () => cart.reduce((total, item) => total + item.quantity, 0),
        [cart]
    );

    React.useEffect(() => {
        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "0, 0, 0";
        };

        const getContrastColor = (hex: string) => {
            const rgb = hexToRgb(hex).split(',').map(n => parseInt(n));
            const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
            return brightness > 155 ? 'hsl(var(--foreground))' : 'hsl(var(--background))';
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
            const targetSucursalId = getSucursalIdForCheckout();
            const res = await apiService.createPublicCheckout({
                items: cart,
                sucursalId: targetSucursalId,
                clienteData,
                envioData
            });

            const checkoutToken = res?.checkout_token ?? res?.data?.checkout_token;
            if (checkoutToken) {
                saveCheckoutToken(checkoutToken, targetSucursalId);
            }

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

    React.useEffect(() => {
        if (!checkoutReturnStatus) return;

        const targetSucursalId = getSucursalIdForCheckout();
        const dedupeKey = `${checkoutReturnStatus}:${targetSucursalId}`;
        if (handledReturnRef.current === dedupeKey) return;
        handledReturnRef.current = dedupeKey;

        const checkoutToken = readCheckoutToken(targetSucursalId);
        if (!checkoutToken) return;

        let cancelled = false;

        const runStatusPolling = async () => {
            setCheckoutFeedback({
                kind: "polling",
                message: "Estamos confirmando tu pago. Esto puede tardar unos segundos...",
            });

            const startTime = Date.now();
            while (!cancelled && Date.now() - startTime < CHECKOUT_POLL_TIMEOUT_MS) {
                try {
                    const statusRes = await apiService.getPublicCheckoutStatus(checkoutToken);

                    if (statusRes?.status === "PAID") {
                        clearCheckoutToken();
                        setCheckoutFeedback({
                            kind: "success",
                            message: "Pago confirmado. Tu compra fue procesada con exito.",
                        });
                        toast.success("Pago confirmado");
                        return;
                    }

                    if (statusRes?.status === "FAILED") {
                        clearCheckoutToken();
                        setCheckoutFeedback({
                            kind: "error",
                            message: statusRes?.reason || "No se pudo confirmar el pago. Intenta nuevamente.",
                        });
                        toast.error("No se pudo confirmar el pago");
                        return;
                    }
                } catch {
                    // Seguimos reintentando hasta timeout para no cortar por errores transitorios.
                }

                await new Promise((resolve) => setTimeout(resolve, CHECKOUT_POLL_INTERVAL_MS));
            }

            if (!cancelled) {
                setCheckoutFeedback({
                    kind: "error",
                    message: "La confirmacion esta demorando mas de lo esperado. Revisaremos el estado automaticamente.",
                });
                toast.message("Seguimos confirmando tu pago");
            }
        };

        runStatusPolling();

        return () => {
            cancelled = true;
        };
    }, [checkoutReturnStatus, clearCheckoutToken, getSucursalIdForCheckout, readCheckoutToken]);

    // --- Render Loading/Error ---
    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--store-canvas)] text-foreground p-6">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Loader2 className="h-10 w-10 text-foreground" />
                </motion.div>
                <p className="mt-4 text-muted-foreground animate-pulse font-medium">Cargando catálogo exclusivo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--store-canvas)] p-6 text-center text-foreground">
                <div className="bg-destructive/10 p-4 rounded-full mb-4">
                    <XCircle className="h-12 w-12 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Ops!</h1>
                <p className="text-muted-foreground max-w-md">{error}</p>
                <Button variant="outline" className="mt-6 border-border" onClick={() => window.location.reload()}>Reintentar</Button>
            </div>
        );
    }

    // --- Motor de Filtrado y Ordenamiento Avanzado (E-commerce Style) ---
    const filteredProducts = React.useMemo(() => {
        if (!products.length) return [];

        const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

        const result = products.filter((p: any) => {
            const matchesSearch = p.nombre.toLowerCase().includes(normalizedSearch);

            if (selectedSubcategory) {
                return matchesSearch && p.subcategoriaId === selectedSubcategory;
            }

            const matchesCategory = !selectedCategory || p.categoriaId === selectedCategory;
            return matchesSearch && matchesCategory;
        });

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
            default:
                break;
        }

        return result;
    }, [products, deferredSearchTerm, selectedSubcategory, selectedCategory, sortBy]);

    return (
        <div
            className={cn(
                "min-h-screen selection:bg-foreground selection:text-[color:var(--ui-fx-white)] transition-colors duration-500 store-theme-root",
                pageBgClass
            )}
            style={{ fontFamily: config.typography ? `"${config.typography}", sans-serif` : undefined }}
        >
            <StoreHeader
                config={config}
                cartCount={cartCount}
                onOpenCart={() => setIsCartOpen(true)}
            />

            <main className="container mx-auto px-3 sm:px-5 md:px-8 py-5 md:py-10 flex flex-col gap-5 sm:gap-8 min-h-[60vh]">
                {checkoutFeedback ? (
                    <div
                        className={cn(
                            "rounded-xl border px-4 py-3 text-sm flex items-center gap-3",
                            checkoutFeedback.kind === "polling" && "bg-[color:var(--theme-ocean-primary)] border-[color:var(--theme-ocean-primary)] text-[color:var(--theme-ocean-primary)]",
                            checkoutFeedback.kind === "success" && "bg-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)] text-[color:var(--status-success-strong)]",
                            checkoutFeedback.kind === "error" && "bg-[color:var(--status-danger)] border-[color:var(--status-danger)] text-[color:var(--status-danger)]",
                        )}
                    >
                        {checkoutFeedback.kind === "polling" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {checkoutFeedback.kind === "success" && <CheckCircle2 className="h-4 w-4" />}
                        {checkoutFeedback.kind === "error" && <XCircle className="h-4 w-4" />}
                        <span>{checkoutFeedback.message}</span>
                    </div>
                ) : null}

                <StoreBanner config={config} />

                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start relative w-full">
                        <StoreCategorySidebar
                            config={config}
                            categories={categories}
                            categoryCounts={categoryCounts}
                            selectedCategory={selectedCategory}
                            setSelectedCategory={(id) => {
                                setSelectedCategory(id);
                                setSelectedSubcategory(null); // Reset subcategory when category changes
                            }}
                            selectedSubcategory={selectedSubcategory}
                            setSelectedSubcategory={setSelectedSubcategory}
                            totalProducts={products.length}
                            allProducts={products}
                        />

                    <div className="flex-1 flex flex-col gap-5 sm:gap-8 min-w-0 w-full">
                        <StoreFilters
                            config={config}
                            products={products}
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
                    <a
                        href="/login"
                        className="text-xs sm:text-sm text-muted-foreground/80 hover:text-foreground transition-colors underline underline-offset-4"
                    >
                        Panel Administrador
                    </a>
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

