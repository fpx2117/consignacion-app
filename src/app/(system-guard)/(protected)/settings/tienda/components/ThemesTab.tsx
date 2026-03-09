/* eslint-disable */
// @ts-nocheck
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
    {
        id: "modern",
        name: "Moderno",
        tagline: "Elegante y atemporal",
        primary: "#000000",
        secondary: "#f3f4f6",
        accent: "#374151"
    },
    {
        id: "nature",
        name: "Natural",
        tagline: "Fresco y orgánico",
        primary: "#16a34a",
        secondary: "#dcfce7",
        accent: "#86efac"
    },
    {
        id: "ocean",
        name: "Océano",
        tagline: "Sereno y confiable",
        primary: "#0284c7",
        secondary: "#e0f2fe",
        accent: "#7dd3fc"
    },
    {
        id: "sunset",
        name: "Atardecer",
        tagline: "Cálido y dinámico",
        primary: "#ea580c",
        secondary: "#ffedd5",
        accent: "#fdba74"
    },
    {
        id: "luxury",
        name: "Lujo",
        tagline: "Premium y sofisticado",
        primary: "#854d0e",
        secondary: "#fefce8",
        accent: "#d97706"
    },
    {
        id: "minimal",
        name: "Minimalista",
        tagline: "Simple y claro",
        primary: "#171717",
        secondary: "#ffffff",
        accent: "#a3a3a3"
    },
    {
        id: "barbie",
        name: "Pop",
        tagline: "Vibrante y divertido",
        primary: "#db2777",
        secondary: "#fce7f3",
        accent: "#f9a8d4"
    },
    {
        id: "tech",
        name: "Tech",
        tagline: "Moderno y digital",
        primary: "#4f46e5",
        secondary: "#e0e7ff",
        accent: "#a5b4fc"
    },
];

export function ThemesTab({ branding, setBranding }: any) {
    const handleThemeSelect = (theme: typeof THEMES[0]) => {
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
                {THEMES.map((theme) => {
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
                                            ? "bg-white scale-100 opacity-100"
                                            : "bg-white/0 scale-75 opacity-0 group-hover:bg-white/20 group-hover:scale-100 group-hover:opacity-100"
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
