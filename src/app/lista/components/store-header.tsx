"use client";

import Image from "next/image";
import { ShoppingCart, Store, Clock, MapPin, BadgeCheck, Search } from "lucide-react";
import { normalizeStorefrontContent } from "@/lib/storefront-content";
import type { PublicCatalogConfig } from "@/lib/types";

interface StoreHeaderProps {
    config: PublicCatalogConfig;
    cartCount: number;
    onOpenCart: () => void;
    searchTerm?: string;
    onSearchChange?: (val: string) => void;
}

export function StoreHeader({ config, cartCount, onOpenCart, searchTerm, onSearchChange }: StoreHeaderProps) {
    const logoSrc = config.logoUrl || (config.logoData ? `data:${config.logoMime};base64,${config.logoData}` : null);
    const bannerSrc = config.bannerUrl || (config.bannerData ? `data:${config.bannerMime};base64,${config.bannerData}` : null);
    const cartEnabled = Boolean(config.convertirTienda);
    const content = normalizeStorefrontContent(config.storefrontContent, { storeName: config.businessName });
    const ols = config.onlineStoreConfig;

    const storeName = ols?.storeName || config.businessName || "Tienda";
    const openingHours = ols?.openingHours || "";
    const addressText = ols?.addressText || config.address || "";
    const storeDescription = ols?.description || content.heroDescription || "";
    const heroBadge = content.heroBadge || "";
    const announcementText = content.announcementText || "";
    const hasBanner = Boolean(bannerSrc);
    const hasLogo = Boolean(logoSrc);

    return (
        <header className="relative bg-[var(--store-surface,#FFFFFF)]">
            {/* ── Barra de anuncio (configurable desde Home tab) ── */}
            {announcementText && (
                <div className="text-center text-xs font-medium py-2 px-4 text-white" style={{ backgroundColor: "var(--store-primary,#007AFF)" }}>
                    {announcementText}
                </div>
            )}

            {/* ══════════════════════════════════════
                BANNER (visible en ambos breakpoints)
            ══════════════════════════════════════ */}
            <div className={`relative w-full overflow-hidden ${hasBanner ? "h-40 sm:h-52 lg:h-56" : "h-20 lg:h-24"}`}>
                {hasBanner ? (
                    <>
                        <Image
                            src={bannerSrc!}
                            alt={storeName}
                            fill
                            sizes="100vw"
                            className="object-cover"
                            priority
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/50 lg:to-black/60" />
                    </>
                ) : (
                    <div
                        className="w-full h-full"
                        style={{
                            background: `linear-gradient(135deg, var(--store-primary,#007AFF) 0%, color-mix(in srgb, var(--store-primary,#007AFF) 65%, #000) 100%)`,
                        }}
                    />
                )}

                {/* Nombre de app sobre el banner — solo desktop, centrado */}
                {content.heroTitle && (
                    <div className="absolute top-3 inset-x-0 hidden lg:flex justify-center pointer-events-none">
                        <span className="text-white/60 text-xs font-medium tracking-widest uppercase px-3 py-1">
                            {content.heroTitle}
                        </span>
                    </div>
                )}

                {/* Desktop: buscador sobre el banner */}
                {onSearchChange && (
                    <div className="absolute bottom-4 inset-x-0 hidden lg:flex justify-center px-8 pointer-events-auto">
                        <div className="w-full max-w-xl flex items-center bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 focus-within:ring-2 focus-within:ring-white/60 focus-within:border-white transition-all">
                            <Search className="h-5 w-5 ml-4 flex-shrink-0 transition-colors"
                                style={{ color: (searchTerm ?? "") ? "var(--store-primary,#007AFF)" : "#6B7280" }}
                            />
                            <input
                                type="text"
                                value={searchTerm ?? ""}
                                onChange={(e) => onSearchChange(e.target.value)}
                                placeholder={ols?.storeName ? `Buscar en ${ols.storeName}...` : "Buscar productos..."}
                                className="flex-1 pl-3 pr-4 py-3 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ══════════════════════════════════════
                INFO DEL COMERCIO (Mobile: superpuesta | Desktop: debajo del banner)
            ══════════════════════════════════════ */}
            <div className="relative z-10">
                {/* ─── MOBILE: logo flotante + nombre debajo ─── */}
                <div className="lg:hidden px-4 pb-4">
                    {/* Fila 1: Logo (sobresale sobre el banner) + botón carrito */}
                    <div className="flex items-end justify-between">
                        <div className="flex-shrink-0 w-20 h-20 -mt-10 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-white">
                            {hasLogo ? (
                                <Image src={logoSrc!} alt={storeName} width={80} height={80} unoptimized className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white" style={{ backgroundColor: "var(--store-primary,#007AFF)" }}>
                                    <Store className="h-9 w-9" />
                                </div>
                            )}
                        </div>
                        {/* Botón carrito mobile */}
                        {cartEnabled && (
                            <button
                                onClick={onOpenCart}
                                aria-label="Abrir carrito"
                                className="relative flex-shrink-0 w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 mb-1"
                                style={{ backgroundColor: "var(--store-primary,#007AFF)" }}
                            >
                                <ShoppingCart className="h-5 w-5" />
                                {cartCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
                                        {cartCount > 9 ? "9+" : cartCount}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Fila 2: Nombre + verificado + horarios + dirección */}
                    <div className="mt-1">
                        <div className="flex items-center gap-1.5">
                            <h1 className="font-bold text-xl text-[var(--store-text,#0F172A)] leading-tight truncate">{storeName}</h1>
                            <BadgeCheck className="h-5 w-5 flex-shrink-0" style={{ color: "var(--store-primary,#007AFF)" }} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--store-muted,#8A8F98)]">
                            {openingHours && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 flex-shrink-0" />{openingHours}
                                </span>
                            )}
                            {addressText && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate max-w-[160px]">{addressText}</span>
                                </span>
                            )}
                        </div>
                        {heroBadge && (
                            <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: "var(--store-primary,#007AFF)", color: "#fff" }}
                            >{heroBadge}</span>
                        )}
                        {storeDescription && (
                            <p className="mt-1 text-xs text-[var(--store-muted,#8A8F98)] leading-snug line-clamp-2">{storeDescription}</p>
                        )}
                    </div>
                </div>

                {/* ─── DESKTOP: barra horizontal sticky debajo del banner ─── */}
                <div className="hidden lg:block sticky top-0 z-30 bg-[var(--store-surface,#FFFFFF)] border-b border-gray-100 shadow-sm">
                    <div className="max-w-screen-2xl mx-auto px-6 py-0">
                        <div className="flex items-center gap-5 h-16">
                            {/* Logo pequeño */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white">
                                {hasLogo ? (
                                    <Image src={logoSrc!} alt={storeName} width={40} height={40} unoptimized className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white" style={{ backgroundColor: "var(--store-primary,#007AFF)" }}>
                                        <Store className="h-5 w-5" />
                                    </div>
                                )}
                            </div>

                            {/* Nombre + badge */}
                            <div className="flex items-center gap-1.5 min-w-0">
                                <h1 className="font-bold text-lg text-[var(--store-text,#0F172A)] truncate">{storeName}</h1>
                                <BadgeCheck className="h-5 w-5 flex-shrink-0" style={{ color: "var(--store-primary,#007AFF)" }} />
                            </div>

                            {/* Separador */}
                            <div className="h-6 w-px bg-gray-200 flex-shrink-0" />

                            {/* Info de horarios + dirección */}
                            <div className="flex items-center gap-4 text-xs text-[var(--store-muted,#8A8F98)] min-w-0">
                                {openingHours && (
                                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />{openingHours}
                                    </span>
                                )}
                                {addressText && (
                                    <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />{addressText}
                                    </span>
                                )}
                            </div>

                            {/* Badge + descripción (Home tab) */}
                            {heroBadge && (
                                <span className="hidden xl:inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: "var(--store-primary,#007AFF)", color: "#fff" }}
                                >{heroBadge}</span>
                            )}
                            {storeDescription && (
                                <span className="hidden lg:block text-xs text-[var(--store-muted,#8A8F98)] truncate max-w-[240px] flex-shrink">{storeDescription}</span>
                            )}

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* Botón carrito desktop */}
                            {cartEnabled && (
                                <button
                                    onClick={onOpenCart}
                                    aria-label="Abrir carrito"
                                    className="relative flex items-center gap-2.5 px-5 py-2 rounded-full text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95 shadow-md"
                                    style={{ backgroundColor: "var(--store-primary,#007AFF)" }}
                                >
                                    <ShoppingCart className="h-4 w-4" />
                                    <span>Mi pedido</span>
                                    {cartCount > 0 && (
                                        <span className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-white text-[10px] font-black text-[var(--store-primary,#007AFF)]">
                                            {cartCount > 9 ? "9+" : cartCount}
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Separador mobile */}
            <div className="lg:hidden h-px bg-gray-100 mx-4" />
        </header>
    );
}
