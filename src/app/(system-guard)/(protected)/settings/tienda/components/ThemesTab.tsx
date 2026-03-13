/* eslint-disable */
// @ts-nocheck
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_PRESETS = [
    {
        id: "modern",
        name: "Moderno",
        tagline: "Elegante y atemporal",
        primaryToken: "--theme-modern-primary",
        secondaryToken: "--theme-modern-secondary",
        accentToken: "--theme-modern-accent",
    },
    {
        id: "nature",
        name: "Natural",
        tagline: "Fresco y orgánico",
        primaryToken: "--theme-nature-primary",
        secondaryToken: "--theme-nature-secondary",
        accentToken: "--theme-nature-accent",
    },
    {
        id: "ocean",
        name: "Océano",
        tagline: "Sereno y confiable",
        primaryToken: "--theme-ocean-primary",
        secondaryToken: "--theme-ocean-secondary",
        accentToken: "--theme-ocean-accent",
    },
    {
        id: "sunset",
        name: "Atardecer",
        tagline: "Cálido y dinámico",
        primaryToken: "--theme-sunset-primary",
        secondaryToken: "--theme-sunset-secondary",
        accentToken: "--theme-sunset-accent",
    },
    {
        id: "luxury",
        name: "Lujo",
        tagline: "Premium y sofisticado",
        primaryToken: "--theme-luxury-primary",
        secondaryToken: "--theme-luxury-secondary",
        accentToken: "--theme-luxury-accent",
    },
    {
        id: "minimal",
        name: "Minimalista",
        tagline: "Simple y claro",
        primaryToken: "--theme-minimal-primary",
        secondaryToken: "--theme-minimal-secondary",
        accentToken: "--theme-minimal-accent",
    },
    {
        id: "barbie",
        name: "Pop",
        tagline: "Vibrante y divertido",
        primaryToken: "--theme-barbie-primary",
        secondaryToken: "--theme-barbie-secondary",
        accentToken: "--theme-barbie-accent",
    },
    {
        id: "tech",
        name: "Tech",
        tagline: "Moderno y digital",
        primaryToken: "--theme-tech-primary",
        secondaryToken: "--theme-tech-secondary",
        accentToken: "--theme-tech-accent",
    },
];

function resolveToken(token: string): string {
    if (typeof window === "undefined") return "hsl(var(--primary))";
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    return value || "hsl(var(--primary))";
}

export function ThemesTab({ branding, setBranding }: any) {
    const themes = React.useMemo(
        () =>
            THEME_PRESETS.map((theme) => ({
                ...theme,
                primary: resolveToken(theme.primaryToken),
                secondary: resolveToken(theme.secondaryToken),
                accent: resolveToken(theme.accentToken),
            })),
        [],
    );

    const handleThemeSelect = (theme: (typeof themes)[0]) => {
        setBranding({
            ...branding,
            themeIdentifier: theme.id,
            primaryColor: theme.primary,
            secondaryColor: theme.secondary,
        });
    };

    return (
        <div className="space-y-4">
            {/* Minimal explainer — single line */}
            <p className="text-xs text-muted-foreground px-1">
                Elegí una combinación de colores — podés ajustarlos en{" "}
                <span className="font-semibold text-foreground">Identidad Visual</span>.
            </p>

            {/* Theme grid — 2 cols mobile, 4 cols desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {themes.map((theme) => {
                    const isActive = branding.themeIdentifier === theme.id;

                    return (
                        <button
                            key={theme.id}
                            onClick={() => handleThemeSelect(theme)}
                            className={cn(
                                "group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer",
                                "transition-all duration-200 ease-out text-left",
                                "motion-reduce:transition-none",
                                "hover:scale-[1.02] hover:shadow-lg",
                                isActive
                                    ? "ring-[2.5px] ring-primary shadow-md shadow-primary/10"
                                    : "ring-1 ring-border hover:ring-primary/40 hover:shadow-md"
                            )}
                        >
                            {/* Color swatch area — paint chip layout */}
                            <div className="relative aspect-[4/3] w-full overflow-hidden">
                                {/* Primary — dominant fill (70%) */}
                                <div
                                    className="absolute inset-0"
                                    style={{ backgroundColor: theme.primary }}
                                />

                                {/* Accent — diagonal band (20%) */}
                                <div
                                    className="absolute bottom-0 right-0 w-[55%] h-[55%] rounded-tl-[2rem]"
                                    style={{ backgroundColor: theme.accent }}
                                />

                                {/* Secondary — nested corner chip (10%) */}
                                <div
                                    className="absolute bottom-0 right-0 w-[30%] h-[30%] rounded-tl-[1.25rem]"
                                    style={{ backgroundColor: theme.secondary }}
                                />

                                {/* Selection checkmark — top-right corner */}
                                <div
                                    className={cn(
                                        "absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center",
                                        "transition-all duration-200",
                                        isActive
                                            ? "bg-card scale-100 opacity-100"
                                            : "bg-card/0 scale-75 opacity-0 group-hover:bg-card/20 group-hover:scale-100 group-hover:opacity-100"
                                    )}
                                >
                                    {isActive && (
                                        <Check
                                            className="h-3 w-3 animate-in zoom-in-50 duration-200"
                                            style={{ color: theme.primary }}
                                            strokeWidth={3}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Label area */}
                            <div className="px-3 py-2.5 bg-background">
                                <p className="text-[13px] font-bold leading-tight truncate">
                                    {theme.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground italic truncate mt-0.5">
                                    {theme.tagline}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
