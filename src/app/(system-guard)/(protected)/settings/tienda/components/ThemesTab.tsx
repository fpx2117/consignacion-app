import * as React from "react";
import { Sparkles, Check } from "lucide-react";
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
        <div className="space-y-5">
            {/* Header explainer */}
            <div className="bg-background border border-border rounded-2xl p-5">
                <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black">Paletas Predefinidas</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Seleccioná una combinación coordinada para aplicar al instante.
                            Podés ajustar los colores manualmente desde <span className="font-bold text-foreground">Identidad Visual</span>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Theme grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {THEMES.map((theme) => {
                    const isActive = branding.themeIdentifier === theme.id;
                    return (
                        <button
                            key={theme.id}
                            onClick={() => handleThemeSelect(theme)}
                            className={cn(
                                "group relative rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-200 text-left",
                                "hover:-translate-y-0.5 hover:shadow-lg",
                                isActive
                                    ? "border-primary ring-2 ring-primary/25 shadow-md"
                                    : "border-border hover:border-primary/40"
                            )}
                        >
                            {/* Color preview — 3 bands */}
                            <div className="flex h-20 w-full">
                                <div className="flex-[3]" style={{ backgroundColor: theme.primary }} />
                                <div className="flex-[1]" style={{ backgroundColor: theme.accent }} />
                                <div className="flex-[2]" style={{ backgroundColor: theme.secondary }} />
                            </div>

                            {/* Name + check */}
                            <div className="px-3 py-2.5 flex items-start justify-between gap-2 bg-background">
                                <div className="min-w-0">
                                    <p className="text-xs font-black truncate">{theme.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{theme.tagline}</p>
                                </div>
                                {isActive && (
                                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0 animate-in zoom-in duration-200">
                                        <Check className="h-3 w-3 text-primary-foreground" />
                                    </div>
                                )}
                            </div>

                            {/* Swatches preview strip */}
                            <div className="absolute top-2 left-2 flex gap-1">
                                <div
                                    className="h-3.5 w-3.5 rounded-full border border-white/30 shadow-sm"
                                    style={{ backgroundColor: theme.primary }}
                                />
                                <div
                                    className="h-3.5 w-3.5 rounded-full border border-white/30 shadow-sm"
                                    style={{ backgroundColor: theme.accent }}
                                />
                                <div
                                    className="h-3.5 w-3.5 rounded-full border border-white/30 shadow-sm"
                                    style={{ backgroundColor: theme.secondary }}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Currently selected */}
            {branding.themeIdentifier && (
                <div className="animate-in fade-in duration-300 flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex gap-1.5">
                        {(() => {
                            const t = THEMES.find(th => th.id === branding.themeIdentifier);
                            if (!t) return null;
                            return [t.primary, t.accent, t.secondary].map((c, i) => (
                                <div key={i} className="h-4 w-4 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: c }} />
                            ));
                        })()}
                    </div>
                    <p className="text-xs font-bold text-primary">
                        Tema activo: {THEMES.find(t => t.id === branding.themeIdentifier)?.name}
                    </p>
                </div>
            )}
        </div>
    );
}
