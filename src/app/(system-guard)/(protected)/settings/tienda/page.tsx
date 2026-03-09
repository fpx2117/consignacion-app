/* eslint-disable */
// @ts-nocheck
 
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiService } from "@/lib/apiService";
import { TutorialButton } from "@/components/ui/tutorial-button";
import { TIENDA_TUTORIAL } from "@/lib/tutorial-content";

// UI Components
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// Icons
import {
    Palette,
    Layout,
    Globe,
    Save,
    Loader2,
    RefreshCw,
    ChevronLeft,
    Smartphone,
    Laptop,
    Eye,
    X,
    Star,
    Check,
} from "lucide-react";

// Store Settings Components
import { BrandingTab } from "./components/BrandingTab";
import { LayoutTab } from "./components/LayoutTab";
import { ThemesTab } from "./components/ThemesTab";
import { SocialTab } from "./components/SocialTab";
import { StorePreviewArea } from "./components/StorePreviewArea";

type SettingCategory = 'branding' | 'layout' | 'themes' | 'social';

/* ─── Skeleton shimmer block for loading state ─── */
function SkeletonBlock({ className }: { className?: string }) {
    return (
        <div className={cn("rounded-xl bg-muted/60 relative overflow-hidden", className)}>
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
    );
}

export default function TiendaSettingsPage() {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<SettingCategory>("branding");
    const [previewMode, setPreviewMode] = React.useState<"mobile" | "desktop">("desktop");
    const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
    const [isDirty, setIsDirty] = React.useState(false);
    const [savedOnce, setSavedOnce] = React.useState(false);
    const [showSavedCheck, setShowSavedCheck] = React.useState(false);
    const [previewPortalReady, setPreviewPortalReady] = React.useState(false);

    const [branding, setBranding] = React.useState<any>({
        businessName: "",
        primaryColor: "#000000",
        secondaryColor: "#3b82f6",
        footerText: "",
        phone: "",
        address: "",
        instagramUrl: "",
        facebookUrl: "",
        whatsappNumber: "",
        themeIdentifier: "modern",
        logoData: null,
        logoMime: null,
        bannerData: null,
        bannerMime: null,
        typography: "inter",
    });

    const [config, setConfig] = React.useState<any>({
        tiendaLayout: "grid",
        mostrarCategoriasEnHeader: true,
        convertirTienda: true,
        mostrarPreciosConsignacion: false,
        mostrarBuscador: true,
    });

    const setBrandingWithDirty = React.useCallback((value: any) => {
        setBranding(value);
        setIsDirty(true);
    }, []);

    const setConfigWithDirty = React.useCallback((value: any) => {
        setConfig(value);
        setIsDirty(true);
    }, []);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        setIsDirty(false);
        try {
            const [brandingRes, configRes] = await Promise.all([
                apiService.getBranding(),
                apiService.getConfiguracionGeneral()
            ]);

            if (brandingRes) setBranding((prev: any) => ({ ...prev, ...brandingRes }));
            if (configRes) setConfig((prev: any) => ({ ...prev, ...configRes }));
        } catch {
            toast.error("Error al cargar la configuración de la tienda");
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    React.useEffect(() => {
        setPreviewPortalReady(true);
    }, []);

    React.useEffect(() => {
        if (!isPreviewOpen) return;

        document.body.style.overflow = "hidden";

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsPreviewOpen(false);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isPreviewOpen]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                apiService.actualizarBranding(branding),
                apiService.actualizarConfiguracionGeneral({
                    tiendaLayout: config.tiendaLayout,
                    mostrarCategoriasEnHeader: config.mostrarCategoriasEnHeader,
                    convertirTienda: config.convertirTienda,
                    mostrarPreciosConsignacion: config.mostrarPreciosConsignacion,
                    mostrarBuscador: config.mostrarBuscador
                })
            ]);
            toast.success("Configuración guardada correctamente");
            setIsDirty(false);
            setSavedOnce(true);
            setShowSavedCheck(true);
            setTimeout(() => setShowSavedCheck(false), 2500);
        } catch {
            toast.error("Error al guardar la configuración");
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            toast.error("La imagen es demasiado grande (máx 20MB)");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const [mimeInfo, data] = base64String.split(';base64,');
            const mime = mimeInfo.split(':')[1];

            if (type === 'logo') {
                setBrandingWithDirty((prev: any) => ({ ...prev, logoData: data, logoMime: mime }));
            } else {
                setBrandingWithDirty((prev: any) => ({ ...prev, bannerData: data, bannerMime: mime }));
            }
        };
        reader.readAsDataURL(file);
    };

    const categories = [
        { id: 'branding', label: 'Identidad Visual', icon: Palette, description: 'Logos, colores y tipografía' },
        { id: 'layout', label: 'Estructura', icon: Layout, description: 'Grilla, buscador y opciones' },
        { id: 'themes', label: 'Temas', icon: Star, description: 'Paletas predefinidas' },
        { id: 'social', label: 'Redes y Contacto', icon: Globe, description: 'Presencia digital' },
    ];

    const activeCat = categories.find(c => c.id === activeTab);

    /* ─── Loading: elegant skeleton ─── */
    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
                {/* Skeleton header */}
                <div className="h-14 border-b flex items-center px-6 gap-4">
                    <SkeletonBlock className="h-7 w-7 rounded-lg" />
                    <SkeletonBlock className="h-4 w-40 rounded-md" />
                    <div className="flex-1" />
                    <SkeletonBlock className="h-8 w-20 rounded-lg" />
                </div>
                <div className="flex-1 flex">
                    {/* Skeleton sidebar */}
                    <div className="w-[240px] border-r p-5 space-y-3 hidden lg:block">
                        <SkeletonBlock className="h-3 w-16 rounded mb-5" />
                        {[1, 2, 3, 4].map(i => (
                            <SkeletonBlock key={i} className="h-11 w-full rounded-xl" />
                        ))}
                    </div>
                    {/* Skeleton content */}
                    <div className="flex-1 p-8 space-y-5 max-w-2xl">
                        <SkeletonBlock className="h-6 w-48 rounded-lg" />
                        <SkeletonBlock className="h-3 w-64 rounded" />
                        <div className="pt-4 space-y-4">
                            <SkeletonBlock className="h-32 w-full rounded-2xl" />
                            <SkeletonBlock className="h-24 w-full rounded-2xl" />
                            <SkeletonBlock className="h-20 w-full rounded-2xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Shimmer keyframes */}
            <style jsx global>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>

            <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
                {/* ═══════ Header ═══════ */}
                <header className="flex-none px-4 sm:px-6 py-2 border-b border-border/60 bg-background/80 backdrop-blur-sm flex items-center justify-between gap-2 z-30">
                    <div className="flex items-center gap-3 min-w-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="h-8 w-8 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
                        >
                            <Link href="/settings">
                                <ChevronLeft className="h-4 w-4" />
                            </Link>
                        </Button>

                        <div className="h-px w-4 bg-border/60 hidden sm:block" />

                        <div className="flex items-center gap-2 min-w-0">
                            <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">
                                Personalizar Tienda
                            </h1>
                            <TutorialButton steps={TIENDA_TUTORIAL} />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Unsaved indicator - subtle dot + text */}
                        {isDirty && (
                            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 animate-in fade-in duration-200 mr-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Cambios sin guardar
                            </span>
                        )}

                        {/* Saved check - animated, auto-dismisses */}
                        {showSavedCheck && !isDirty && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in zoom-in-95 duration-300 mr-1">
                                <Check className="h-3.5 w-3.5" />
                                Guardado
                            </span>
                        )}

                        {isDirty && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={loadData}
                                className="h-8 rounded-lg hidden sm:flex text-xs text-muted-foreground hover:text-foreground"
                            >
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                Descartar
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPreviewOpen(true)}
                            className="h-8 rounded-lg text-xs font-medium hidden sm:inline-flex"
                        >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            Preview
                        </Button>

                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={saving || !isDirty}
                            className={cn(
                                "h-8 rounded-lg font-medium text-xs px-2 sm:px-4 transition-all duration-200 gap-1.5",
                                isDirty
                                    ? "shadow-sm shadow-primary/25"
                                    : ""
                            )}
                        >
                            {saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : showSavedCheck && !isDirty ? (
                                <Check className="h-3.5 w-3.5" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">{saving ? "Guardando..." : "Guardar"}</span>
                        </Button>
                    </div>
                </header>

                {/* ═══════ Main Content Area ═══════ */}
                <div className="flex-1 flex overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/30">
                    <aside className="w-[240px] flex-none border-r border-border/50 bg-background hidden lg:flex flex-col">
                        <nav className="flex-1 p-4 pt-6">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-4 px-3">
                                Secciones
                            </p>
                            <div className="space-y-1">
                                {categories.map((cat) => {
                                    const isActive = activeTab === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setActiveTab(cat.id as SettingCategory)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group relative transition-colors duration-200",
                                                isActive
                                                    ? "bg-primary/[0.06] dark:bg-primary/[0.12]"
                                                    : "hover:bg-muted/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-300",
                                                isActive ? "h-5 bg-primary" : "h-0 bg-transparent"
                                            )} />

                                            <div className={cn(
                                                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200",
                                                isActive
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted/60 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
                                            )}>
                                                <cat.icon className="h-3.5 w-3.5" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className={cn(
                                                    "text-[13px] font-medium truncate transition-colors duration-200",
                                                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                                )}>
                                                    {cat.label}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground/50 truncate">
                                                    {cat.description}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </nav>

                        <div className="p-4 pt-0">
                            <div className="flex items-center gap-2.5 px-3 py-2.5 text-[11px] text-muted-foreground">
                                <span className={cn(
                                    "h-2 w-2 rounded-full shrink-0 transition-colors",
                                    config.convertirTienda ? "bg-emerald-500" : "bg-muted-foreground/30"
                                )} />
                                <span className="font-medium">
                                    {config.convertirTienda ? "Tienda activa" : "Tienda inactiva"}
                                </span>
                            </div>
                        </div>
                    </aside>

                    <ScrollArea className="flex-1">
                        <div className="p-4 sm:p-8 max-w-3xl mx-auto pb-32">

                            {/* Mobile tabs - refined pills with scroll snap */}
                            <div className="lg:hidden mb-6 -mx-4 sm:-mx-8 px-4 sm:px-8">
                                <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-hide">
                                    {categories.map((cat) => {
                                        const isActive = activeTab === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => setActiveTab(cat.id as SettingCategory)}
                                                className={cn(
                                                    "flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 snap-start transition-all duration-200 border",
                                                    isActive
                                                        ? "bg-foreground text-background border-foreground shadow-sm"
                                                        : "bg-background text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
                                                )}
                                            >
                                                <cat.icon className="h-3.5 w-3.5" />
                                                {cat.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section Header - bigger, more presence */}
                            <div className="mb-8">
                                <div className="flex items-center gap-3.5 mb-1">
                                    {activeCat && (
                                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <activeCat.icon className="h-[18px] w-[18px] text-primary" />
                                        </div>
                                    )}
                                    <div>
                                        <h2 className="text-xl font-semibold tracking-tight text-foreground">
                                            {activeCat?.label}
                                        </h2>
                                        <p className="text-sm text-muted-foreground/70 mt-0.5">
                                            {activeCat?.description}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-7 rounded-xl border border-border/60 bg-background/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Vista previa en pantalla completa para no interrumpir la edición.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsPreviewOpen(true)}
                                    className="h-8 rounded-lg text-xs font-medium shrink-0 w-full sm:w-auto"
                                >
                                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                                    Abrir preview
                                </Button>
                            </div>

                            <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {activeTab === "branding" && <BrandingTab branding={branding} setBranding={setBrandingWithDirty} handleImageUpload={handleImageUpload} />}
                                {activeTab === "layout" && <LayoutTab config={config} setConfig={setConfigWithDirty} />}
                                {activeTab === "themes" && <ThemesTab branding={branding} setBranding={setBrandingWithDirty} />}
                                {activeTab === "social" && <SocialTab branding={branding} setBranding={setBrandingWithDirty} />}
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                {previewPortalReady && isPreviewOpen && createPortal((
                    <div
                        className="fixed inset-0 z-[2147483000] bg-background/95 backdrop-blur-sm"
                        onClick={() => setIsPreviewOpen(false)}
                    >
                        <div className="h-full w-full flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="border-b border-border/60 px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <p className="text-sm font-medium truncate">Vista previa de tu tienda</p>
                                        <span className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-emerald-600/80">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            LIVE
                                        </span>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg shrink-0 sm:hidden"
                                        onClick={() => setIsPreviewOpen(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between gap-2 sm:justify-end">
                                    <div className="flex items-center gap-1 p-0.5 bg-muted rounded-lg">
                                        <button
                                            onClick={() => setPreviewMode("mobile")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200",
                                                previewMode === "mobile"
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Smartphone className="h-3.5 w-3.5" />
                                            Movil
                                        </button>
                                        <button
                                            onClick={() => setPreviewMode("desktop")}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200",
                                                previewMode === "desktop"
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Laptop className="h-3.5 w-3.5" />
                                            Web
                                        </button>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-lg hidden sm:inline-flex"
                                        onClick={() => setIsPreviewOpen(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="relative flex-1 p-4 sm:p-6 bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-100 dark:from-zinc-900 dark:via-zinc-900/70 dark:to-zinc-950 flex items-center justify-center overflow-hidden">
                                <div className={cn(
                                    "bg-white transform-gpu transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ring-1 ring-black/[0.06] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)]",
                                    previewMode === "mobile"
                                        ? "w-[350px] h-[740px] max-h-full rounded-[2.5rem]"
                                        : "w-[min(1400px,94vw)] h-[min(820px,86vh)] rounded-2xl"
                                )}>
                                    <StorePreviewArea branding={branding} config={config} mode={previewMode} />
                                </div>
                            </div>
                        </div>
                    </div>
                ), document.body)}

                {/* ═══════ Mobile FAB for save (only when dirty) ═══════ */}
                {isDirty && (
                    <div className="fixed bottom-6 right-6 sm:hidden z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
                        <Button
                            size="lg"
                            onClick={handleSave}
                            disabled={saving}
                            className="h-12 w-12 rounded-full shadow-lg shadow-primary/30 p-0"
                        >
                            {saving ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Save className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
