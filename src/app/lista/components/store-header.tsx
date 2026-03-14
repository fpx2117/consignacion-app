/* eslint-disable */
// @ts-nocheck
"use client";

import Image from "next/image";
import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";

interface StoreHeaderProps {
    config: any;
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
                        <div className={cn("relative h-9 sm:h-10 w-20 sm:w-24 shrink-0 overflow-hidden", radiusClass)}>
                            <Image
                                src={logoSrc}
                                alt={config.businessName || "Logo"}
                                fill
                                sizes="(max-width: 640px) 80px, 96px"
                                className={cn(
                                    "object-contain",
                                    theme !== 'minimal' && theme !== 'luxury' ? "shadow-sm" : ""
                                )}
                            />
                        </div>
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

                <div className="flex items-center shrink-0" />
            </div>
        </header>
    );
}
