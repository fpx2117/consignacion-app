"use client";

import Image from "next/image";
import { ShoppingCart, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeStorefrontContent } from "@/lib/storefront-content";
import type { PublicCatalogConfig } from "@/lib/types";

interface StoreHeaderProps {
    config: PublicCatalogConfig;
    cartCount: number;
    onOpenCart: () => void;
}

export function StoreHeader({ config, cartCount, onOpenCart }: StoreHeaderProps) {
    const logoSrc = config.logoUrl || (config.logoData ? `data:${config.logoMime};base64,${config.logoData}` : null);
    const cartEnabled = Boolean(config.convertirTienda);
    const content = normalizeStorefrontContent(config.storefrontContent, { storeName: config.businessName });

    return (
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
            {content.announcementText && (
                <div className="text-center text-xs font-medium py-2 px-4 text-white" style={{ backgroundColor: config.primaryColor || "#111827" }}>
                    {content.announcementText}
                </div>
            )}

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        {logoSrc ? (
                            <Image src={logoSrc} alt={config.businessName || "Logo"} width={40} height={40} unoptimized className="h-9 w-9 rounded-lg object-contain" />
                        ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: config.primaryColor || "#111827" }}>
                                <Store className="h-5 w-5" />
                            </div>
                        )}
                        <span className="hidden sm:block text-lg font-bold tracking-tight text-gray-900 truncate">
                            {config.businessName || "Tienda"}
                        </span>
                    </div>

                    {cartEnabled && (
                        <Button variant="ghost" onClick={onOpenCart} className="relative h-10 gap-2 px-3 text-gray-700 hover:bg-gray-100 rounded-xl">
                            <ShoppingCart className="h-5 w-5" />
                            {cartCount > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: config.primaryColor || "#111827" }}>
                                    {cartCount}
                                </span>
                            )}
                            <span className="hidden sm:inline text-sm font-medium">Carrito</span>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
