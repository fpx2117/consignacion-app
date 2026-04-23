"use client";

import Image from "next/image";
import { PackageOpen, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicCatalogConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";

interface StoreHeaderProps {
    config: PublicCatalogConfig;
    cartCount: number;
    onOpenCart: () => void;
}

export function StoreHeader({ config, cartCount, onOpenCart }: StoreHeaderProps) {
    const { theme, radiusClass, headerBgClass } = getThemeStyles(config.themeIdentifier);
    const logoSrc = config.logoUrl || (config.logoData ? `data:${config.logoMime};base64,${config.logoData}` : null);

    return (
        <header className={cn(
            "sticky top-0 z-40 backdrop-blur-xl border-b border-border/40 transition-all h-16 sm:h-20",
            headerBgClass,
            theme === 'minimal' || theme === 'luxury' || theme === 'tech' ? "border-none px-2 shadow-sm" : ""
        )}>
            <div className="container mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-2 relative">

                {/* Logo y Nombre */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 max-w-[75vw] sm:max-w-none">
                    {logoSrc ? (
                        <Image
                            src={logoSrc}
                            alt={config.businessName || "Logo"}
                            width={96}
                            height={40}
                            unoptimized
                            className={cn(
                                "h-9 sm:h-10 w-auto max-w-24 object-contain shrink-0",
                                radiusClass,
                                theme !== 'minimal' && theme !== 'luxury' ? "shadow-sm" : ""
                            )}
                        />
                    ) : (
                        <div className={cn("p-2 bg-muted/55 shrink-0", radiusClass)}>
                            <PackageOpen className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
                        </div>
                    )}
                    <div className="flex flex-col justify-center text-left min-w-0">
                        <h1 className={cn(
                            "text-[14px] sm:text-lg font-black tracking-tight text-foreground leading-none truncate",
                            theme === 'minimal' || theme === 'luxury' ? "uppercase tracking-widest text-base" : ""
                        )}>
                            {config.businessName || "Nuestra Tienda"}
                        </h1>
                        <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1 truncate">
                            Catálogo Oficial
                        </p>
                    </div>
                </div>

                <div className="flex items-center shrink-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onOpenCart}
                        className={cn(
                            "relative h-10 px-3 sm:h-11 sm:px-4 border-border/70 bg-[color:rgba(var(--store-surface-rgb),0.8)] backdrop-blur-md font-bold text-foreground hover:bg-foreground hover:text-[color:var(--ui-fx-white)]",
                            radiusClass,
                        )}
                    >
                        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="ml-2 hidden sm:inline">Carrito</span>
                        <span className="ml-2 inline-flex min-w-6 h-6 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-black text-[color:var(--ui-fx-white)]">
                            {cartCount}
                        </span>
                    </Button>
                </div>
            </div>
        </header>
    );
}
