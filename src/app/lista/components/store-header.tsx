"use client";

import { PackageOpen, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getThemeStyles } from "../lib/theme-utils";

interface StoreHeaderProps {
    config: any;
    cartCount: number;
    onOpenCart: () => void;
}

export function StoreHeader({ config, cartCount, onOpenCart }: StoreHeaderProps) {
    const { theme, radiusClass, buttonRadiusClass, buttonHoverClass, headerBgClass } = getThemeStyles(config.themeIdentifier);

    return (
        <header className={cn(
            // Cambiamos min-h-[4rem] por h-16 fijo para garantizar el centrado exacto
            "sticky top-0 z-40 backdrop-blur-xl border-b border-border/40 transition-all h-16 sm:h-20",
            headerBgClass,
            theme === 'minimal' || theme === 'luxury' || theme === 'tech' ? "border-none px-2 shadow-sm" : ""
        )}>
            {/* Eliminamos el py-3. El h-full con items-center hace un centrado perfecto */}
            <div className="container mx-auto px-3 sm:px-4 h-full flex items-center justify-center sm:justify-between relative">

                {/* Logo y Nombre */}
                <div className="flex items-center gap-2.5 sm:gap-3 max-w-[58vw] sm:max-w-none">
                    {config.logoData ? (
                        <img
                            src={`data:${config.logoMime};base64,${config.logoData}`}
                            alt={config.businessName || "Logo"}
                            className={cn(
                                "h-9 sm:h-10 w-auto object-contain shrink-0",
                                radiusClass,
                                theme !== 'minimal' && theme !== 'luxury' ? "shadow-sm" : ""
                            )}
                        />
                    ) : (
                        <div className={cn("p-2 bg-neutral-100 shrink-0", radiusClass)}>
                            <PackageOpen className="h-5 w-5 sm:h-6 sm:w-6 text-neutral-900" />
                        </div>
                    )}
                    <div className="flex flex-col justify-center text-left">
                        <h1 className={cn(
                            "text-[15px] sm:text-lg font-black tracking-tight text-neutral-900 leading-none truncate",
                            theme === 'minimal' || theme === 'luxury' ? "uppercase tracking-widest text-base" : ""
                        )}>
                            {config.businessName || "Nuestra Tienda"}
                        </h1>
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-neutral-500 font-bold mt-1">
                            Catálogo Oficial
                        </p>
                    </div>
                </div>

                {/* Botón Carrito: Centrado matemático absoluto en celular */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 sm:static sm:translate-y-0 flex items-center">
                    {config.convertirTienda && (
                        <Button
                            variant="outline"
                            className={cn(
                                "relative h-10 w-10 sm:w-auto px-0 sm:px-5 sm:h-11 border-neutral-200 hover:border-neutral-300 bg-white/80 transition-all shadow-sm group",
                                buttonRadiusClass,
                                buttonHoverClass,
                                theme === 'barbie' || theme === 'ocean' || theme === 'sunset' || theme === 'nature' ? "border-primary text-primary" : ""
                            )}
                            onClick={onOpenCart}
                        >
                            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2 text-neutral-900 group-hover:scale-110 transition-transform" />
                            <span className="hidden sm:inline font-semibold text-neutral-900">Carrito</span>

                            {cartCount > 0 && (
                                <span className={cn(
                                    "absolute -top-1 -right-1 sm:top-0 sm:-right-1 h-5 w-5 bg-neutral-900 text-[10px] text-white font-bold flex items-center justify-center animate-in zoom-in shadow-md border-2 border-white",
                                    buttonRadiusClass
                                )}>
                                    {cartCount}
                                </span>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}