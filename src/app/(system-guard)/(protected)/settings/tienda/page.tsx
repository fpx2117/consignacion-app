/* eslint-disable */
// @ts-nocheck
 
"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiService } from "@/lib/apiService";
import { TutorialButton } from "@/components/ui/tutorial-button";
import { TIENDA_TUTORIAL } from "@/lib/tutorial-content";

// UI Components
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    Star,
    Store,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";

// Store Settings Components
import { BrandingTab } from "./components/BrandingTab";
import { LayoutTab } from "./components/LayoutTab";
import { ThemesTab } from "./components/ThemesTab";
import { SocialTab } from "./components/SocialTab";
import { StorePreviewArea } from "./components/StorePreviewArea";

type SettingCategory = 'branding' | 'layout' | 'themes' | 'social';

export default function TiendaSettingsPage() {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<SettingCategory>("branding");
    const [previewMode, setPreviewMode] = React.useState<"mobile" | "desktop">("desktop");
    const [isDirty, setIsDirty] = React.useState(false);
    const [savedOnce, setSavedOnce] = React.useState(false);

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

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-5">
                    <div className="relative">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Store className="h-6 w-6 text-primary" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-sm font-bold">Cargando editor visual</p>
                        <p className="text-xs text-muted-foreground">Un momento...</p>
                    </div>
                </div>
            </div>
        );
    }

    const categories = [
        { id: 'branding', label: 'Identidad Visual', icon: Palette, description: 'Logos, colores y tipografía', step: '01' },
        { id: 'layout', label: 'Estructura', icon: Layout, description: 'Grilla, buscador y opciones', step: '02' },
        { id: 'themes', label: 'Temas', icon: Star, description: 'Paletas predefinidas', step: '03' },
        { id: 'social', label: 'Redes y Contacto', icon: Globe, description: 'Presencia digital', step: '04' },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-stretch h-[calc(100vh)] overflow-hidden">
            {/* Header Principal */}
            <header className="flex-none h-[60px] px-5 border-b bg-background flex items-center justify-between z-20 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 rounded-lg shrink-0">
                        <Link href="/settings">
                            <ChevronLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                            <Store className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm font-black tracking-tight">Personalizar Tienda</h1>
                                <TutorialButton steps={TIENDA_TUTORIAL} />
                                {isDirty && (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 animate-in fade-in duration-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                                        Sin guardar
                                    </span>
                                )}
                                {savedOnce && !isDirty && (
                                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Guardado
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground hidden sm:block truncate">Configura la apariencia pública de tu catálogo</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {isDirty && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadData}
                            className="h-8 rounded-lg hidden sm:flex text-xs font-semibold text-muted-foreground"
                        >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Descartar
                        </Button>
                    )}
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={saving || !isDirty}
                        className={cn(
                            "h-8 rounded-lg font-bold text-xs px-4 transition-all duration-200",
                            isDirty
                                ? "shadow-md shadow-primary/20"
                                : "opacity-60"
                        )}
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                        Guardar
                    </Button>
                </div>
            </header>

            {/* Content Split Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                <aside className="w-[220px] flex-none border-r bg-background hidden lg:flex flex-col">
                    <div className="p-3 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-3 px-2">Secciones</p>
                        <nav className="space-y-0.5">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.id as SettingCategory)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group relative",
                                        activeTab === cat.id
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <cat.icon className={cn(
                                        "h-4 w-4 shrink-0 transition-transform",
                                        activeTab === cat.id ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                                    )} />
                                    <div className="flex-1 min-w-0">
                                        <div className={cn(
                                            "text-xs font-bold truncate",
                                            activeTab === cat.id ? "text-primary-foreground" : ""
                                        )}>
                                            {cat.label}
                                        </div>
                                        <div className={cn(
                                            "text-[10px] truncate",
                                            activeTab === cat.id ? "text-primary-foreground/70" : "text-muted-foreground/60"
                                        )}>
                                            {cat.description}
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "text-[9px] font-black font-mono",
                                        activeTab === cat.id ? "text-primary-foreground/50" : "text-muted-foreground/30"
                                    )}>
                                        {cat.step}
                                    </span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Status footer */}
                    <div className="p-3 border-t">
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold",
                            config.convertirTienda
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
                                : "bg-muted text-muted-foreground border border-border"
                        )}>
                            <span className={cn(
                                "h-2 w-2 rounded-full shrink-0",
                                config.convertirTienda ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                            )} />
                            <span>{config.convertirTienda ? "Tienda en línea" : "Tienda offline"}</span>
                        </div>
                    </div>
                </aside>

                {/* Middle Content Area */}
                <ScrollArea className="flex-1 bg-zinc-50/80 dark:bg-zinc-900/50">
                    <div className="p-5 max-w-2xl mx-auto pb-32">
                        {/* Mobile Category Tabs */}
                        <div className="lg:hidden mb-5 flex overflow-x-auto gap-1.5 pb-1 scrollbar-hide">
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.id as SettingCategory)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all",
                                        activeTab === cat.id
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-background text-muted-foreground hover:text-foreground border border-border"
                                    )}
                                >
                                    <cat.icon className="h-3.5 w-3.5" />
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                        {/* Section Header */}
                        <div className="mb-5 flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                {(() => {
                                    const cat = categories.find(c => c.id === activeTab);
                                    if (!cat) return null;
                                    const Icon = cat.icon;
                                    return <Icon className="h-4 w-4 text-primary" />;
                                })()}
                            </div>
                            <div>
                                <h2 className="text-lg font-black tracking-tight leading-none">
                                    {categories.find(c => c.id === activeTab)?.label}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {categories.find(c => c.id === activeTab)?.description}
                                </p>
                            </div>
                        </div>

                        <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-3 duration-300">
                            {activeTab === "branding" && <BrandingTab branding={branding} setBranding={setBrandingWithDirty} handleImageUpload={handleImageUpload} />}
                            {activeTab === "layout" && <LayoutTab config={config} setConfig={setConfigWithDirty} />}
                            {activeTab === "themes" && <ThemesTab branding={branding} setBranding={setBrandingWithDirty} />}
                            {activeTab === "social" && <SocialTab branding={branding} setBranding={setBrandingWithDirty} />}
                        </div>
                    </div>
                </ScrollArea>

                {/* Right Preview Area */}
                <aside className="w-[430px] xl:w-[480px] flex-none hidden md:flex flex-col bg-zinc-100 dark:bg-zinc-950 border-l relative overflow-hidden">
                    {/* Dot pattern */}
                    <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '20px 20px' }} />

                    {/* Preview Toolbar */}
                    <div className="flex-none px-4 py-3 flex items-center justify-between z-10 border-b border-border/40">
                        <div className="flex gap-1 p-1 bg-zinc-200/60 dark:bg-zinc-800/60 rounded-lg">
                            <button
                                onClick={() => setPreviewMode('mobile')}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                                    previewMode === 'mobile'
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Smartphone className="h-3.5 w-3.5" />
                                Móvil
                            </button>
                            <button
                                onClick={() => setPreviewMode('desktop')}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                                    previewMode === 'desktop'
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Laptop className="h-3.5 w-3.5" />
                                Web
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {isDirty && (
                                <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                    <AlertCircle className="h-3 w-3" />
                                    Preview sin guardar
                                </div>
                            )}
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-bold text-[10px] h-5 px-2">
                                ● LIVE
                            </Badge>
                        </div>
                    </div>

                    {/* Preview Device Frame */}
                    <div className="flex-1 flex items-center justify-center p-4 z-10 overflow-hidden relative">
                        <div className={cn(
                            "transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] drop-shadow-2xl ring-1 ring-border/20 bg-white absolute origin-center transform-gpu",
                            previewMode === 'mobile'
                                ? "w-[340px] h-[720px] scale-[0.82] xl:scale-90 rounded-[2.5rem]"
                                : "w-[1200px] h-[800px] scale-[0.34] xl:scale-[0.38] rounded-lg"
                        )}>
                            <StorePreviewArea branding={branding} config={config} mode={previewMode} />
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
