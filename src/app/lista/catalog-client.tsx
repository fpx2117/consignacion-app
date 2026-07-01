"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
    CatalogCartItem,
    PublicCatalogConfig,
    PublicCatalogData,
    PublicCatalogProduct,
    PublicCheckoutCustomerData,
    PublicCheckoutShippingData,
} from "@/lib/types";

import { apiService } from "@/lib/apiService";
import { buildCatalogCartWhatsappUrl } from "@/lib/storefront/catalog-whatsapp";

// Componentes
import { StoreHeader } from "./components/store-header";
import { CategoryTabs } from "./components/category-tabs";
import { PromoCarousel } from "./components/promo-carousel";
import { ProductSection } from "./components/product-section";
import { SearchBar } from "./components/search-bar";
import { StoreFooter } from "./components/store-footer";
import { DesktopCategorySidebar } from "./components/desktop-category-sidebar";
import { ProductCard } from "./components/product-card";

const CartDrawer = dynamic(
  () => import("./components/cart-drawer").then((m) => m.CartDrawer),
  { ssr: false }
);

const ProductModal = dynamic(
  () => import("./components/product-modal").then((m) => m.ProductModal),
  { ssr: false }
);

// ─── Constantes ───────────────────────────────────────────────────────────────
const CHECKOUT_TOKEN_STORAGE_KEY = "public_checkout_token_v2";
const CART_STORAGE_KEY_PREFIX = "public_catalog_cart_v1";
const CHECKOUT_POLL_INTERVAL_MS = 2000;
const CHECKOUT_POLL_TIMEOUT_MS = 90000;

type CheckoutFeedbackState = { kind: "polling" | "success" | "error"; message: string };
type StoredCheckoutToken = { token: string; sucursalId: number; createdAt: number };

// ─────────────────────────────────────────────────────────────────────────────

export function CatalogClient({
    initialData,
    initialError = null,
    sucursalId,
    checkoutReturnStatus,
}: {
    initialData: PublicCatalogData | null;
    initialError?: string | null;
    sucursalId: number | null;
    checkoutReturnStatus: string | null;
}) {
    // ── Datos ──
    const [data, setData] = React.useState<PublicCatalogData | null>(initialData);
    const [loading, setLoading] = React.useState(!initialData && !initialError);
    const [error, setError] = React.useState<string | null>(initialError);

    // ── Filtros ──
    const [searchTerm, setSearchTerm] = React.useState("");
    const [selectedCategory, setSelectedCategory] = React.useState<number | null>(null);
    const [selectedSubcategory, setSelectedSubcategory] = React.useState<number | null>(null);
    const [isConsigne, setIsConsigne] = React.useState(false);
    const [selectedProduct, setSelectedProduct] = React.useState<PublicCatalogProduct | null>(null);
    // ── Carrito ──
    const [cart, setCart] = React.useState<CatalogCartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = React.useState(false);
    const [checkoutLoading, setCheckoutLoading] = React.useState(false);
    const [checkoutFeedback, setCheckoutFeedback] = React.useState<CheckoutFeedbackState | null>(null);
    const [cartHydrated, setCartHydrated] = React.useState(false);

    const handledReturnRef = React.useRef<string | null>(null);

    // ── Storage helpers ──
    const getSucursalIdForCheckout = React.useCallback(() => sucursalId ?? 1, [sucursalId]);
    const getCartStorageKey = React.useCallback(
        () => `${CART_STORAGE_KEY_PREFIX}:${getSucursalIdForCheckout()}`,
        [getSucursalIdForCheckout]
    );
    const clearCheckoutToken = React.useCallback(() => {
        if (typeof window !== "undefined") window.localStorage.removeItem(CHECKOUT_TOKEN_STORAGE_KEY);
    }, []);
    const storeCheckoutToken = React.useCallback((token: string, storeSucursalId: number) => {
        if (typeof window === "undefined") return;
        const payload: StoredCheckoutToken = {
            token,
            sucursalId: storeSucursalId,
            createdAt: Date.now(),
        };
        window.localStorage.setItem(CHECKOUT_TOKEN_STORAGE_KEY, JSON.stringify(payload));
    }, []);
    const readCheckoutToken = React.useCallback((storeSucursalId: number): string | null => {
        if (typeof window === "undefined") return null;
        const raw = window.localStorage.getItem(CHECKOUT_TOKEN_STORAGE_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as StoredCheckoutToken;
            const expired = Date.now() - Number(parsed.createdAt || 0) > 24 * 60 * 60 * 1000;
            const mismatch = Number(parsed.sucursalId) !== Number(storeSucursalId);
            if (!parsed.token || expired || mismatch) {
                window.localStorage.removeItem(CHECKOUT_TOKEN_STORAGE_KEY);
                return null;
            }
            return parsed.token;
        } catch {
            window.localStorage.removeItem(CHECKOUT_TOKEN_STORAGE_KEY);
            return null;
        }
    }, []);

    // ── Fetch datos ──
    React.useEffect(() => {
        if (initialData || initialError) { setLoading(false); return; }
        const fetchData = async () => {
            try {
                const res = await apiService.getPublicListaPrecios(sucursalId ?? undefined);
                setData(res);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Error al cargar el catálogo");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [initialData, initialError, sucursalId]);

    // ── Carrito persistido ──
    React.useEffect(() => {
        if (typeof window === "undefined") return;
        const raw = window.localStorage.getItem(getCartStorageKey());
        if (!raw) { setCart([]); setCartHydrated(true); return; }
        try {
            const parsed = JSON.parse(raw) as CatalogCartItem[];
            setCart(Array.isArray(parsed) ? parsed : []);
        } catch {
            window.localStorage.removeItem(getCartStorageKey());
            setCart([]);
        } finally {
            setCartHydrated(true);
        }
    }, [getCartStorageKey]);

    React.useEffect(() => {
        if (typeof window === "undefined" || !cartHydrated) return;
        window.localStorage.setItem(getCartStorageKey(), JSON.stringify(cart));
    }, [cart, cartHydrated, getCartStorageKey]);

    // ── Config y datos derivados ──
    const config: PublicCatalogConfig = data?.config ?? { sucursalId: sucursalId ?? 1 };
    const products = React.useMemo(() => data?.productos || [], [data?.productos]);
    const categories = React.useMemo(() => data?.categorias || [], [data?.categorias]);
    const deferredSearchTerm = React.useDeferredValue(searchTerm);

    const ols = config.onlineStoreConfig;
    const showCategories = ols?.catalog?.showCategories ?? true;
    const promoEnabled = ols?.promotions?.enabled ?? false;
    const promoItems = ols?.promotions?.items ?? [];
    const maxPerSection = ols?.catalog?.maxProductsPerSection ?? 8;
    const cartEnabled = Boolean(config.tiendaPaymentMode);

    // Sincronizar carrito con stock actualizado
    React.useEffect(() => {
        if (!cartHydrated || !products.length) return;
        setCart(prev => prev.flatMap((item) => {
            const fresh = products.find((p) => p.id === item.id);
            if (!fresh || fresh.stockDisponibleUnits <= 0) return [];
            return [{ ...fresh, quantity: Math.min(item.quantity, fresh.stockDisponibleUnits), pricingMode: item.pricingMode ?? "default" }];
        }));
    }, [cartHydrated, products]);

    const cartCount = React.useMemo(() => cart.reduce((t, i) => t + i.quantity, 0), [cart]);

    // ── Handlers de filtros ──
    const handleSelectCategory = React.useCallback((id: number | null) => {
        setSelectedCategory(id);
        setSelectedSubcategory(null);
    }, []);

    const handleSelectSubcategory = React.useCallback((id: number | null) => {
        setSelectedSubcategory(id);
    }, []);

    // ── Inyección de CSS variables dinámicas ──
    React.useEffect(() => {
        const hexToRgb = (hex: string) => {
            const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return r ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}` : "0, 0, 0";
        };
        const contrast = (hex: string) => {
            const [r = 0, g = 0, b = 0] = hexToRgb(hex).split(",").map(Number);
            return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? "hsl(var(--foreground))" : "hsl(var(--background))";
        };
        if (config.primaryColor) {
            document.documentElement.style.setProperty("--primary", config.primaryColor);
            document.documentElement.style.setProperty("--primary-rgb", hexToRgb(config.primaryColor));
            document.documentElement.style.setProperty("--primary-foreground", contrast(config.primaryColor));
        }
        if (config.secondaryColor) {
            document.documentElement.style.setProperty("--secondary", config.secondaryColor);
            document.documentElement.style.setProperty("--secondary-foreground", contrast(config.secondaryColor));
        }
        if (config.typography) {
            const linkId = `gf-${config.typography.replace(/\s+/g, "-").toLowerCase()}`;
            if (!document.getElementById(linkId)) {
                const link = document.createElement("link");
                link.id = linkId;
                link.rel = "stylesheet";
                link.href = `https://fonts.googleapis.com/css2?family=${config.typography.replace(/\s+/g, "+")}:wght@300;400;500;600;700;800;900&display=swap`;
                document.head.appendChild(link);
            }
        }
    }, [config.primaryColor, config.secondaryColor, config.typography]);

    // ── Lógica del Carrito ──
    const addToCart = (product: PublicCatalogProduct, quantity = 1) => {
        const maxStock = Math.max(0, product.stockDisponibleUnits || 0);
        if (maxStock <= 0) { toast.error("Este producto no tiene stock disponible."); return; }
        setCart(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                return prev.map(i => i.id === product.id
                    ? { ...i, quantity: Math.min(i.quantity + quantity, maxStock), pricingMode: isConsigne ? "consigne" : "default" }
                    : i
                );
            }
            return [...prev, { ...product, quantity: Math.min(quantity, maxStock), pricingMode: isConsigne ? "consigne" : "default" }];
        });
        toast.success(`${product.nombre} agregado al carrito`);
    };

    const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.id !== id));

    const updateQuantity = (id: number, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.id !== id) return i;
            return { ...i, quantity: Math.max(1, Math.min(i.stockDisponibleUnits, i.quantity + delta)) };
        }));
    };

    // Seteo directo desde el stepper de las cards (0 = eliminar)
    const handleUpdateCartQuantity = React.useCallback((productId: number, newQty: number) => {
        if (newQty <= 0) {
            setCart(prev => prev.filter(i => i.id !== productId));
            return;
        }
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const max = Math.max(1, product.stockDisponibleUnits ?? 999);
        setCart(prev => {
            const existing = prev.find(i => i.id === productId);
            if (existing) {
                return prev.map(i =>
                    i.id === productId ? { ...i, quantity: Math.min(newQty, max), pricingMode: isConsigne ? "consigne" : "default" } : i
                );
            }
            // No está en el carrito → agregar
            return [...prev, { ...product, quantity: Math.min(newQty, max), pricingMode: isConsigne ? "consigne" : "default" }];
        });
    }, [products, isConsigne]);

    const handleCheckout = async (clienteData: PublicCheckoutCustomerData, envioData: PublicCheckoutShippingData) => {
        // Modo Catálogo: el carrito se envía como pedido por WhatsApp, sin pasar por Mercado Pago.
        if (config.tiendaPaymentMode === "whatsapp") {
            setCheckoutLoading(true);
            try {
                const whatsappUrl = buildCatalogCartWhatsappUrl({
                    config,
                    cart,
                    clienteData,
                    envioData,
                    tiendaUrl: typeof window !== "undefined" ? window.location.href : null,
                });
                if (!whatsappUrl) {
                    toast.error("No hay un número de WhatsApp configurado para esta tienda.");
                    return;
                }
                window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                setCart([]);
                setIsCartOpen(false);
                setCheckoutFeedback({ kind: "success", message: "Abrimos WhatsApp con tu pedido listo para enviar." });
                toast.success("Pedido preparado para WhatsApp");
            } finally {
                setCheckoutLoading(false);
            }
            return;
        }

        // Modo Tienda Online: checkout vía Mercado Pago.
        setCheckoutLoading(true);
        try {
            const checkoutResponse = await apiService.createPublicCheckout({
                items: cart,
                sucursalId: getSucursalIdForCheckout(),
                clienteData,
                envioData,
            });

            if (!checkoutResponse?.init_point || !checkoutResponse.checkout_token) {
                throw new Error("No pudimos iniciar el checkout online.");
            }

            storeCheckoutToken(checkoutResponse.checkout_token, getSucursalIdForCheckout());
            setCheckoutFeedback({ kind: "polling", message: "Redirigiendo al pago seguro..." });

            if (typeof window !== "undefined") {
                window.location.assign(checkoutResponse.init_point);
            }
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error al preparar el pedido");
        } finally {
            setCheckoutLoading(false);
        }
    };

    // ── Polling de checkout ──
    React.useEffect(() => {
        if (!checkoutReturnStatus) return;
        const targetId = getSucursalIdForCheckout();
        const key = `${checkoutReturnStatus}:${targetId}`;
        if (handledReturnRef.current === key) return;
        handledReturnRef.current = key;
        const token = readCheckoutToken(targetId);
        if (!token) return;
        let cancelled = false;
        const poll = async () => {
            setCheckoutFeedback({ kind: "polling", message: "Confirmando tu pago..." });
            const start = Date.now();
            while (!cancelled && Date.now() - start < CHECKOUT_POLL_TIMEOUT_MS) {
                try {
                    const res = await apiService.getPublicCheckoutStatus(token);
                    if (res?.status === "PAID") {
                        clearCheckoutToken();
                        setCart([]);
                        setIsCartOpen(false);
                        setCheckoutFeedback({ kind: "success", message: "¡Pago confirmado! Tu ticket ya está siendo preparado." });
                        return;
                    }
                    if (res?.status === "FAILED") {
                        clearCheckoutToken();
                        setCheckoutFeedback({ kind: "error", message: res?.reason || "No se pudo confirmar el pago." });
                        return;
                    }
                } catch { /* retry */ }
                await new Promise(r => setTimeout(r, CHECKOUT_POLL_INTERVAL_MS));
            }
            if (!cancelled) setCheckoutFeedback({ kind: "error", message: "La confirmación está demorando. Revisaremos el estado." });
        };
        poll();
        return () => { cancelled = true; };
    }, [checkoutReturnStatus, clearCheckoutToken, getSucursalIdForCheckout, readCheckoutToken]);

    // ── Secciones destacadas como categorías virtuales ──
    const virtualCategories = React.useMemo(() => {
        const sections = ols?.catalog?.featuredSections || [];
        return sections
            .map((s: { title: string; productIds: number[]; displayMode?: string }, i: number) => ({
                id: -(i + 1),
                nombre: (s.title || "Destacados"),
                isVirtual: true as const,
                productIds: s.productIds,
                displayMode: (s.displayMode || "slider-static") as "slider-auto" | "slider-static" | "grid",
            }))
            .filter(vc => vc.productIds.length > 0);
    }, [ols?.catalog?.featuredSections]);

    // ── Motor de filtrado (soporta categorías virtuales) ──
    const filteredProducts = React.useMemo(() => {
        if (!products.length) return [];
        const q = deferredSearchTerm.trim().toLowerCase();
        const activeVirtual = virtualCategories.find(vc => vc.id === selectedCategory);

        const result = products.filter((p) => {
            const matchSearch = !q || p.nombre.toLowerCase().includes(q);
            if (selectedSubcategory) return matchSearch && p.subcategoriaId === selectedSubcategory;
            // Virtual: filtrar por lista de IDs
            if (activeVirtual) return matchSearch && activeVirtual.productIds.includes(p.id);
            const matchCat = !selectedCategory || p.categoriaId === selectedCategory;
            return matchSearch && matchCat;
        });
        result.sort((a, b) => {
            const sa = a.stockDisponibleUnits > 0 ? 1 : 0;
            const sb = b.stockDisponibleUnits > 0 ? 1 : 0;
            return sb - sa;
        });
        return result;
    }, [products, deferredSearchTerm, selectedSubcategory, selectedCategory, virtualCategories]);

    // ── Categorías combinadas (virtuales + reales) para sidebar y tabs ──
    const allCategories = React.useMemo(() => {
        return [...virtualCategories, ...categories.map(c => ({ ...c, isVirtual: false as const }))];
    }, [virtualCategories, categories]);

    // ── Secciones por categoría (vista "todas") ──
    const productsByCategory = React.useMemo(() => {
        if (!showCategories) return [];
        // IDs de productos ya usados en secciones virtuales (evitar duplicados)
        const virtualProductIds = new Set(virtualCategories.flatMap(vc => vc.productIds));
        const virtualSections = virtualCategories.map(vc => ({
            category: vc,
            products: filteredProducts.filter(p => vc.productIds.includes(p.id)).slice(0, maxPerSection),
            total: filteredProducts.filter(p => vc.productIds.includes(p.id)).length,
        })).filter(s => s.products.length > 0);
        const realSections = categories.map(cat => ({
            category: cat,
            products: filteredProducts.filter(p => p.categoriaId === cat.id && !virtualProductIds.has(p.id)).slice(0, maxPerSection),
            total: filteredProducts.filter(p => p.categoriaId === cat.id && !virtualProductIds.has(p.id)).length,
        })).filter(s => s.products.length > 0);
        return [...virtualSections, ...realSections];
    }, [categories, virtualCategories, filteredProducts, showCategories, maxPerSection]);

    const uncategorizedProducts = React.useMemo(() => {
        if (!showCategories || categories.length === 0) return filteredProducts.slice(0, maxPerSection * 2);
        return filteredProducts
            .filter((p) => !p.categoriaId || !categories.find((c) => c.id === p.categoriaId))
            .slice(0, maxPerSection);
    }, [filteredProducts, categories, showCategories, maxPerSection]);

    // ── Determinar si hay filtro activo ──
    const hasActiveFilter = Boolean(deferredSearchTerm.trim() || selectedCategory || !showCategories || categories.length === 0);

    // ── Nombre del contexto actual (para el título de la sección) ──
    const activeTitle = React.useMemo(() => {
        if (deferredSearchTerm.trim()) return `Resultados para "${deferredSearchTerm}"`;
        if (selectedSubcategory) {
            const cat = categories.find((c) => c.id === selectedCategory);
            const sub = cat?.subcategorias?.find((s) => s.id === selectedSubcategory);
            return sub?.nombre ?? "Productos";
        }
        if (selectedCategory) {
            const vc = virtualCategories.find(c => c.id === selectedCategory);
            if (vc) return vc.nombre;
            return categories.find((c) => c.id === selectedCategory)?.nombre ?? "Productos";
        }
        return "Todos los productos";
    }, [deferredSearchTerm, selectedCategory, selectedSubcategory, categories, virtualCategories]);

    // ── Consigne (mantener compatibilidad) ──
    React.useEffect(() => {
        if (config.mostrarPreciosConsignacion === false) setIsConsigne(false);
    }, [config.mostrarPreciosConsignacion]);

    // ── LOADING ──
    if (loading) {
        return (
            <div suppressHydrationWarning className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                    <Loader2 className="h-10 w-10 text-[var(--store-primary,#007AFF)]" />
                </motion.div>
                <p className="mt-4 text-[var(--store-muted,#8A8F98)] animate-pulse font-medium">Cargando catálogo...</p>
            </div>
        );
    }

    // ── ERROR ──
    if (error) {
        return (
            <div suppressHydrationWarning className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
                <div className="bg-red-50 p-4 rounded-full mb-4"><XCircle className="h-12 w-12 text-red-500" /></div>
                <h1 className="text-2xl font-bold mb-2 text-[var(--store-text,#0F172A)]">¡Ups!</h1>
                <p className="text-[var(--store-muted,#8A8F98)] max-w-md">{error}</p>
                <Button variant="outline" className="mt-6" onClick={() => window.location.reload()}>Reintentar</Button>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  RENDER PRINCIPAL
    // ═══════════════════════════════════════════════════════════════
    return (
        <div
            suppressHydrationWarning
            className={cn("min-h-screen transition-colors duration-300")}
            style={{
                backgroundColor: "#FFFFFF",
                fontFamily: config.typography ? `"${config.typography}", sans-serif` : undefined,
            }}
        >
            {/* ── Header (mobile + desktop sticky nav) ── */}
            <StoreHeader
                config={config}
                cartCount={cartCount}
                onOpenCart={() => setIsCartOpen(true)}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
            />

            {/* ══════════════════════════════════════════════
                CONTENEDOR PRINCIPAL
                Mobile: columna simple
                Desktop: max-w centrado + 2 cols (sidebar | content)
            ══════════════════════════════════════════════ */}
            <div className="max-w-screen-2xl mx-auto px-0 lg:px-6 xl:px-8">
                <div className="flex gap-6 xl:gap-8 items-start">

                    {/* ── SIDEBAR DE CATEGORÍAS (desktop only) ── */}
                    {showCategories && (
                        <div className="hidden lg:block pt-6">
                            <DesktopCategorySidebar
                                categories={allCategories as any}
                                allProducts={products}
                                selectedCategory={selectedCategory}
                                selectedSubcategory={selectedSubcategory}
                                onSelectCategory={handleSelectCategory}
                                onSelectSubcategory={handleSelectSubcategory}
                                totalProducts={products.length}
                            />
                        </div>
                    )}

                    {/* ── ÁREA PRINCIPAL DE CONTENIDO ── */}
                    <div className="flex-1 min-w-0 pb-24 lg:pb-10">

                        {/* Feedback de checkout */}
                        {checkoutFeedback && (
                            <div className="px-4 pt-4 lg:pt-6">
                                <div className={cn(
                                    "rounded-2xl border px-4 py-3 text-sm flex items-center gap-3",
                                    checkoutFeedback.kind === "polling" && "border-sky-200 bg-sky-50 text-sky-800",
                                    checkoutFeedback.kind === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                                    checkoutFeedback.kind === "error" && "border-red-200 bg-red-50 text-red-800",
                                )}>
                                    {checkoutFeedback.kind === "polling" && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                                    {checkoutFeedback.kind === "success" && <CheckCircle2 className="h-4 w-4 flex-shrink-0" />}
                                    {checkoutFeedback.kind === "error" && <XCircle className="h-4 w-4 flex-shrink-0" />}
                                    <span>{checkoutFeedback.message}</span>
                                </div>
                            </div>
                        )}

                        {/* ── Buscador (mobile) ── */}
                        <div className="px-4 pt-4 pb-2 lg:hidden">
                            <SearchBar
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder={ols?.storeName ? `Buscar en ${ols.storeName}...` : "Buscar productos..."}
                            />
                        </div>

                        {/* ── CategoryTabs (MOBILE only — desktop tiene sidebar) ── */}
                        {showCategories && (
                            <div className="lg:hidden">
                                <CategoryTabs
                                    categories={allCategories as any}
                                    selectedCategory={selectedCategory}
                                    onSelectCategory={handleSelectCategory}
                                    className="mt-2"
                                    allProducts={products}
                                />
                                {/* Subcategorías mobile: chips horizontales */}
                                {selectedCategory !== null && (() => {
                                    const cat = categories.find(c => c.id === selectedCategory);
                                    const subs = cat?.subcategorias?.filter(s =>
                                        products.some(p => p.subcategoriaId === s.id)
                                    ) ?? [];
                                    if (subs.length === 0) return null;
                                    return (
                                        <div className="flex overflow-x-auto gap-2 px-4 py-2.5 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                                            <button
                                                onClick={() => setSelectedSubcategory(null)}
                                                className={cn(
                                                    "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                                                    selectedSubcategory === null
                                                        ? "text-white border-transparent"
                                                        : "text-[var(--store-muted,#8A8F98)] border-gray-200 bg-white"
                                                )}
                                                style={selectedSubcategory === null ? { backgroundColor: "var(--store-primary,#007AFF)" } : undefined}
                                            >
                                                Todo
                                            </button>
                                            {subs.map(sub => (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => setSelectedSubcategory(selectedSubcategory === sub.id ? null : sub.id)}
                                                    className={cn(
                                                        "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
                                                        selectedSubcategory === sub.id
                                                            ? "text-white border-transparent"
                                                            : "text-[var(--store-muted,#8A8F98)] border-gray-200 bg-white"
                                                    )}
                                                    style={selectedSubcategory === sub.id ? { backgroundColor: "var(--store-primary,#007AFF)" } : undefined}
                                                >
                                                    {sub.nombre}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* ── Promociones visuales ── */}
                        {promoEnabled && promoItems.length > 0 && (
                            <PromoCarousel items={promoItems} className="mt-4" />
                        )}

                        {/* ── Breadcrumb desktop (contexto de filtro activo) ── */}
                        {(selectedCategory || selectedSubcategory || deferredSearchTerm.trim()) && (
                            <div className="hidden lg:flex items-center gap-2 px-0 pt-5 pb-1 text-sm text-[var(--store-muted,#8A8F98)]">
                                <button
                                    onClick={() => { handleSelectCategory(null); setSearchTerm(""); }}
                                    className="hover:text-[var(--store-text,#0F172A)] transition-colors"
                                >
                                    Todos
                                </button>
                                {selectedCategory && (
                                    <>
                                        <span>/</span>
                                        <button
                                            onClick={() => handleSelectCategory(selectedCategory)}
                                            className="hover:text-[var(--store-text,#0F172A)] transition-colors"
                                        >
                                            {categories.find(c => c.id === selectedCategory)?.nombre}
                                        </button>
                                    </>
                                )}
                                {selectedSubcategory && (() => {
                                    const cat = categories.find(c => c.id === selectedCategory);
                                    const sub = cat?.subcategorias?.find(s => s.id === selectedSubcategory);
                                    return sub ? (
                                        <>
                                            <span>/</span>
                                            <span className="text-[var(--store-text,#0F172A)] font-medium">{sub.nombre}</span>
                                        </>
                                    ) : null;
                                })()}
                                {deferredSearchTerm.trim() && (
                                    <>
                                        <span>/</span>
                                        <span className="text-[var(--store-text,#0F172A)] font-medium">
                                            &ldquo;{deferredSearchTerm}&rdquo;
                                        </span>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════
                            SECCIONES DE PRODUCTOS
                        ═══════════════════════════════════════════ */}
                        <div className="mt-4 space-y-8 lg:space-y-10 lg:pt-4">

                            {/* Vista filtrada (búsqueda, categoría, subcategoría) */}
                            {hasActiveFilter ? (
                                <ProductSection
                                    title={activeTitle}
                                    count={filteredProducts.length}
                                    products={filteredProducts}
                                    config={config}
                                    viewMode="grid"
                                    isConsigne={isConsigne}
                                    onAddToCart={addToCart}
                                    onViewProduct={(p) => setSelectedProduct(p)}
                                    onViewAll={selectedCategory !== null ? () => handleSelectCategory(null) : undefined}
                                    forceGrid
                                    cart={cart}
                                    onUpdateCartQuantity={handleUpdateCartQuantity}
                                />
                            ) : (
                                /* Vista "todas las categorías" */
                                <>
                                    {productsByCategory.map(({ category, products: catProducts, total }) => {
                                        const isVirtual = (category as any).isVirtual;
                                        const mode = (category as any).displayMode || "slider-static";
                                        const isSlider = isVirtual && mode !== "grid";
                                        const isAuto = mode === "slider-auto";
                                        return (
                                            <div key={category.id}>
                                                {/* Encabezado */}
                                                <div className="flex items-center justify-between px-4 mb-3">
                                                    <div className="flex items-baseline gap-2">
                                                        <h3 className="text-lg font-bold text-[var(--store-text,#0F172A)]">
                                                            {category.nombre}
                                                        </h3>
                                                        <span className="text-sm text-[var(--store-muted,#8A8F98)]">{total}</span>
                                                    </div>
                                                    {/* Ver todos (categorías reales o virtuales con modo grid) */}
                                                    {(!isVirtual || !isSlider) && ols?.catalog?.showViewAll && (
                                                        <button onClick={() => handleSelectCategory(category.id)}
                                                            className="flex items-center gap-0.5 text-sm font-medium text-[var(--store-primary,#007AFF)] hover:opacity-80 transition-opacity whitespace-nowrap">
                                                            Ver todo <ChevronRight className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                                {/* Slider (auto o static) */}
                                                {isSlider ? (
                                                    <SliderRow products={catProducts} config={config} isConsigne={isConsigne}
                                                        addToCart={addToCart} setSelectedProduct={setSelectedProduct}
                                                        cart={cart} handleUpdateCartQuantity={handleUpdateCartQuantity}
                                                        autoScroll={isAuto} />
                                                ) : (
                                                    /* Grilla normal */
                                                    <ProductSection
                                                        title="" count={0}
                                                        products={catProducts} config={config} viewMode="grid"
                                                        isConsigne={isConsigne} onAddToCart={addToCart}
                                                        onViewProduct={(p) => setSelectedProduct(p)}
                                                        forceGrid cart={cart} onUpdateCartQuantity={handleUpdateCartQuantity}
                                                        className="[&>div:first-child]:hidden"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}

                                    {uncategorizedProducts.length > 0 && (
                                        <ProductSection
                                            title="Otros productos"
                                            count={uncategorizedProducts.length}
                                            products={uncategorizedProducts}
                                            config={config}
                                            viewMode="grid"
                                            isConsigne={isConsigne}
                                            onAddToCart={addToCart}
                                            onViewProduct={(p) => setSelectedProduct(p)}
                                            forceGrid
                                            cart={cart}
                                            onUpdateCartQuantity={handleUpdateCartQuantity}
                                        />
                                    )}

                                    {productsByCategory.length === 0 && uncategorizedProducts.length === 0 && products.length > 0 && (
                                        <div className="px-4 py-16 text-center">
                                            <p className="text-[var(--store-muted,#8A8F98)]">No hay productos disponibles en este momento.</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Sin resultados de búsqueda */}
                            {filteredProducts.length === 0 && deferredSearchTerm.trim() && (
                                <div className="px-4 py-16 text-center">
                                    <p className="text-xl font-bold text-[var(--store-text,#0F172A)] mb-2">Sin resultados</p>
                                    <p className="text-[var(--store-muted,#8A8F98)] text-sm mb-4">
                                        No encontramos productos para &ldquo;{deferredSearchTerm}&rdquo;
                                    </p>
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="text-sm font-semibold text-[var(--store-primary,#007AFF)] hover:opacity-80 transition-opacity"
                                    >
                                        Limpiar búsqueda
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Footer — full width, fuera del contenedor centrado */}
            <div className="mt-12 lg:mt-16">
                <StoreFooter config={config} />
            </div>

            {/* ── Botón flotante de carrito (mobile) ── */}
            {cartEnabled && cartCount > 0 && !isCartOpen && (
                <motion.div
                    initial={{ scale: 0, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0, opacity: 0, y: 20 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden"
                >
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="flex items-center gap-3 px-6 py-3.5 rounded-full text-white font-bold shadow-2xl transition-all hover:scale-105 active:scale-95"
                        style={{ backgroundColor: "var(--store-primary,#007AFF)" }}
                    >
                        <span className="bg-white/25 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
                            {cartCount}
                        </span>
                        <span>Ver pedido</span>
                    </button>
                </motion.div>
            )}

            {/* ── CartDrawer ── */}
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

            {/* ── Modal de producto ── */}
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

// ─── Slider horizontal con/sin auto-scroll ───
function SliderRow({ products: items, config, isConsigne, addToCart, setSelectedProduct, cart, handleUpdateCartQuantity, autoScroll }: {
    products: PublicCatalogProduct[];
    config: PublicCatalogConfig;
    isConsigne: boolean;
    addToCart: (p: PublicCatalogProduct, q?: number) => void;
    setSelectedProduct: (p: PublicCatalogProduct) => void;
    cart: CatalogCartItem[];
    handleUpdateCartQuantity: (id: number, qty: number) => void;
    autoScroll: boolean;
}) {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const scrollBy = (amount: number) => {
        scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
    };

    // Auto-scroll
    React.useEffect(() => {
        if (!autoScroll || !scrollRef.current) return;
        const el = scrollRef.current;
        let raf: number;
        const speed = 1.2; // px por frame (~72px/s)
        const animate = () => {
            if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 10) {
                el.scrollLeft = 0;
            } else {
                el.scrollLeft += speed;
            }
            raf = requestAnimationFrame(animate);
        };
        raf = requestAnimationFrame(animate);
        const pause = () => cancelAnimationFrame(raf);
        const resume = () => { raf = requestAnimationFrame(animate); };
        el.addEventListener("mouseenter", pause);
        el.addEventListener("mouseleave", resume);
        el.addEventListener("touchstart", pause, { passive: true });
        el.addEventListener("touchend", resume);
        return () => {
            cancelAnimationFrame(raf);
            el.removeEventListener("mouseenter", pause);
            el.removeEventListener("mouseleave", resume);
        };
    }, [autoScroll]);

    return (
        <div className="relative group">
            {/* Flecha izquierda (desktop) */}
            <button onClick={() => scrollBy(-300)}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 shadow-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
            </button>
            {/* Slider */}
            <div ref={scrollRef}
                className="flex overflow-x-auto gap-3 px-4 snap-x snap-mandatory pb-2 scroll-pl-4"
                style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                <div className="flex-shrink-0 w-0" />
                {items.map((product, index) => (
                    <div key={product.id} className="min-w-[150px] max-w-[160px] sm:min-w-[180px] sm:max-w-[200px] snap-start flex-shrink-0">
                        <ProductCard product={product} config={config} isConsigne={isConsigne} viewMode="grid"
                            onAddToCart={addToCart} onViewProduct={setSelectedProduct} index={index} compact
                            cartQuantity={cart.find(i => i.id === product.id)?.quantity ?? 0}
                            onUpdateCartQuantity={handleUpdateCartQuantity} />
                    </div>
                ))}
                <div className="flex-shrink-0 w-2" />
            </div>
            {/* Flecha derecha (desktop) */}
            <button onClick={() => scrollBy(300)}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 shadow-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
                <ChevronRight className="h-5 w-5 text-gray-700" />
            </button>
        </div>
    );
}
