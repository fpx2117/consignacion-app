import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Image as ImageIcon, Palette, Trash2, FileText, Type, Check,
    ChevronsUpDown, Upload, Camera, MapPin, Phone, Store, X
} from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BrandingPreviewSettings } from "./types";

/* ─── Data ─────────────────────────────────────────────────── */

const GOOGLE_FONTS = [
    { id: 'Inter', name: 'Inter', type: 'Sans Serif' },
    { id: 'Roboto', name: 'Roboto', type: 'Sans Serif' },
    { id: 'Open Sans', name: 'Open Sans', type: 'Sans Serif' },
    { id: 'Lato', name: 'Lato', type: 'Sans Serif' },
    { id: 'Montserrat', name: 'Montserrat', type: 'Sans Serif' },
    { id: 'Oswald', name: 'Oswald', type: 'Sans Serif' },
    { id: 'Raleway', name: 'Raleway', type: 'Sans Serif' },
    { id: 'Merriweather', name: 'Merriweather', type: 'Serif' },
    { id: 'Nunito', name: 'Nunito', type: 'Sans Serif' },
    { id: 'Playfair Display', name: 'Playfair Display', type: 'Serif' },
    { id: 'Rubik', name: 'Rubik', type: 'Sans Serif' },
    { id: 'Poppins', name: 'Poppins', type: 'Sans Serif' },
    { id: 'Lora', name: 'Lora', type: 'Serif' },
    { id: 'Outfit', name: 'Outfit', type: 'Sans Serif' },
    { id: 'Work Sans', name: 'Work Sans', type: 'Sans Serif' },
    { id: 'DM Sans', name: 'DM Sans', type: 'Sans Serif' },
    { id: 'Space Grotesk', name: 'Space Grotesk', type: 'Sans Serif' },
    { id: 'Syne', name: 'Syne', type: 'Display' },
    { id: 'Josefin Sans', name: 'Josefin Sans', type: 'Sans Serif' },
    { id: 'Manrope', name: 'Manrope', type: 'Sans Serif' },
    { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', type: 'Sans Serif' },
    { id: 'Urbanist', name: 'Urbanist', type: 'Sans Serif' },
];

const COLOR_SWATCHES = [
    { token: "--swatch-1", name: "Negro" },
    { token: "--swatch-2", name: "Carbón" },
    { token: "--swatch-3", name: "Pizarra" },
    { token: "--swatch-4", name: "Rojo" },
    { token: "--swatch-5", name: "Naranja" },
    { token: "--swatch-6", name: "Verde" },
    { token: "--swatch-7", name: "Azul" },
    { token: "--swatch-8", name: "Cyan" },
    { token: "--swatch-9", name: "Bronce" },
    { token: "--swatch-10", name: "Rosa" },
    { token: "--swatch-11", name: "Violeta" },
    { token: "--swatch-12", name: "Índigo" },
];

function resolveColorToken(token: string): string {
    if (typeof window === "undefined") return "";
    const styles = getComputedStyle(document.documentElement);
    return styles.getPropertyValue(token).trim() || styles.getPropertyValue("--swatch-1").trim();
}

/* ─── Font Groups ──────────────────────────────────────────── */

const FONT_GROUPS = ['Sans Serif', 'Serif', 'Display'] as const;

function groupedFonts() {
    return FONT_GROUPS.map(type => ({
        type,
        fonts: GOOGLE_FONTS.filter(f => f.type === type),
    })).filter(g => g.fonts.length > 0);
}

/* ─── Color Swatch Palette ─────────────────────────────────── */

function ColorPalette({
    value,
    onChange,
    label,
    hint,
}: {
    value: string;
    onChange: (color: string) => void;
    label: string;
    hint: string;
}) {
    const swatches = React.useMemo(
        () => COLOR_SWATCHES.map((swatch) => ({ ...swatch, hex: resolveColorToken(swatch.token) })),
        [],
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <div
                        className="relative w-9 h-9 rounded-lg border border-border/60 cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                        style={{ backgroundColor: value }}
                    >
                        <input
                            type="color"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4"
                        />
                    </div>
                    <Input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="font-mono rounded-lg h-9 w-24 text-xs uppercase tracking-wider text-center border-border/60"
                        maxLength={7}
                    />
                </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {swatches.map((swatch) => (
                    <button
                        key={swatch.token}
                        type="button"
                        onClick={() => onChange(swatch.hex)}
                        className={cn(
                            "w-8 h-8 rounded-lg border-2 transition-all duration-150 hover:scale-110 relative group",
                            value === swatch.hex
                                ? "border-foreground ring-2 ring-foreground/20 scale-110"
                                : "border-transparent hover:border-border"
                        )}
                        style={{ backgroundColor: swatch.hex }}
                        title={swatch.name}
                    >
                        {value === swatch.hex && (
                            <Check className="h-3.5 w-3.5 text-[color:var(--ui-fx-white)] absolute inset-0 m-auto drop-shadow-md" />
                        )}
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-medium">
                            {swatch.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ─── Main Component ───────────────────────────────────────── */

type BrandingTabProps = {
    branding: BrandingPreviewSettings;
    setBranding: React.Dispatch<React.SetStateAction<BrandingPreviewSettings>>;
    handleImageUpload: (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => void;
};

type BrandingBannerItem = NonNullable<BrandingPreviewSettings["banners"]>[number];

export function BrandingTab({ branding, setBranding, handleImageUpload }: BrandingTabProps) {
    const [fontOpen, setFontOpen] = React.useState(false);
    const [bannerDragOver, setBannerDragOver] = React.useState(false);

    const logoInputRef = React.useRef<HTMLInputElement>(null);
    const bannerInputRef = React.useRef<HTMLInputElement>(null);
    const sliderInputRef = React.useRef<HTMLInputElement>(null);

    // Cargar tipografía para preview
    React.useEffect(() => {
        if (branding.typography && branding.typography !== 'Inter') {
            const fontName = branding.typography;
            const linkId = `branding-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
            if (!document.getElementById(linkId)) {
                const link = document.createElement('link');
                link.id = linkId;
                link.rel = 'stylesheet';
                link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@400;700;900&display=swap`;
                document.head.appendChild(link);
            }
        }
    }, [branding.typography]);

    return (
        <div className="space-y-8">

            {/* ── IMÁGENES ────────────────────────────────────── */}
            <section className="border border-border/50 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-border/30">
                    <div className="flex items-center gap-2.5">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold tracking-tight">Imágenes de la Tienda</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-[26px]">Logo y banner que ven tus clientes</p>
                </div>

                <div className="p-4 sm:p-6 space-y-8">

                    {/* LOGO */}
                    <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                        <input
                            ref={logoInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'logo')}
                        />

                        {/* Preview — click to upload */}
                        <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            className="relative w-24 h-24 rounded-2xl border border-border/60 flex items-center justify-center overflow-hidden shrink-0 bg-muted/20 group cursor-pointer transition-shadow hover:shadow-lg"
                        >
                            {branding.logoData ? (
                                <Image
                                    src={`data:${branding.logoMime};base64,${branding.logoData}`}
                                    alt="Logo"
                                    fill
                                    unoptimized
                                    sizes="96px"
                                    className="object-contain p-2"
                                />
                            ) : (
                                <ImageIcon className="h-8 w-8 text-muted-foreground/25" />
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1 rounded-2xl">
                                <Camera className="h-5 w-5 text-[color:var(--ui-fx-white)]" />
                                <span className="text-[10px] text-[color:var(--ui-fx-white)]/80 font-medium">
                                    {branding.logoData ? "Cambiar" : "Subir"}
                                </span>
                            </div>
                        </button>

                        <div className="pt-1">
                            <p className="text-sm font-semibold">Logo del Negocio</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Hacé click en la imagen para {branding.logoData ? "cambiar" : "subir"} tu logo
                            </p>
                            <p className="text-[11px] text-muted-foreground/60 mt-1">PNG transparente recomendado</p>
                            {branding.logoData && (
                                <button
                                    type="button"
                                    onClick={() => setBranding((prev) => ({ ...prev, logoData: null, logoMime: null }))}
                                    className="mt-2 text-xs text-destructive/70 hover:text-destructive font-medium flex items-center gap-1 transition-colors"
                                >
                                    <Trash2 className="h-3 w-3" /> Eliminar logo
                                </button>
                            )}
                        </div>
                    </div>

                    {/* DIVIDER */}
                    <div className="border-t border-border/30" />

                    {/* TIPO BANNER */}
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                            <div>
                                <p className="text-sm font-semibold">Banner</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Imagen única o carrusel de imágenes</p>
                            </div>
                            <div className="flex p-0.5 bg-muted/60 rounded-lg gap-0.5 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setBranding({ ...branding, isBannerSlider: false })}
                                    className={cn(
                                        "flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                                        !branding.isBannerSlider
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Única
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBranding({ ...branding, isBannerSlider: true })}
                                    className={cn(
                                        "flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                                        branding.isBannerSlider
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Slider
                                </button>
                            </div>
                        </div>

                        {/* Banner único */}
                        {!branding.isBannerSlider && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <input
                                    ref={bannerInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, 'banner')}
                                />

                                {branding.bannerData ? (
                                    <div className="space-y-3">
                                        <div className="relative aspect-[3/1] rounded-xl overflow-hidden border border-border/40 group">
                                            <Image
                                                src={`data:${branding.bannerMime};base64,${branding.bannerData}`}
                                                alt="Banner"
                                                fill
                                                unoptimized
                                                sizes="(max-width: 768px) 100vw, 50vw"
                                                className="object-cover"
                                            />
                                            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    className="rounded-lg text-xs font-medium shadow-lg"
                                                    onClick={() => bannerInputRef.current?.click()}
                                                >
                                                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Cambiar
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    className="rounded-lg text-xs font-medium shadow-lg text-destructive"
                                                    onClick={() => setBranding((prev) => ({ ...prev, bannerData: null, bannerMime: null }))}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Quitar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Subir banner"
                                        className={cn(
                                            "aspect-[3/1] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all duration-300 cursor-pointer select-none",
                                            bannerDragOver
                                                ? "border-primary bg-primary/5 scale-[1.005]"
                                                : "border-border/40 hover:border-primary/40 bg-gradient-to-br from-muted/20 to-muted/40 hover:from-primary/[0.03] hover:to-primary/[0.06] text-muted-foreground hover:text-foreground"
                                        )}
                                        onClick={() => bannerInputRef.current?.click()}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') bannerInputRef.current?.click(); }}
                                        onDragOver={(e) => { e.preventDefault(); setBannerDragOver(true); }}
                                        onDragLeave={() => setBannerDragOver(false)}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setBannerDragOver(false);
                                            const file = e.dataTransfer.files[0];
                                            if (!file) return;
                                            const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                                            handleImageUpload(fakeEvent, 'banner');
                                        }}
                                    >
                                        <div className={cn(
                                            "w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center transition-all",
                                            bannerDragOver ? "bg-primary/10 scale-110" : "group-hover:bg-muted"
                                        )}>
                                            <Upload className={cn(
                                                "h-5 w-5 transition-all",
                                                bannerDragOver ? "text-primary scale-110" : "text-muted-foreground/50"
                                            )} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium">
                                                {bannerDragOver ? "Soltá la imagen aquí" : "Arrastrá una imagen o hacé click"}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground/50 mt-1">
                                                1920 x 640 px recomendado &middot; JPG o PNG
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Slider */}
                        {branding.isBannerSlider && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                <input
                                    ref={sliderInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        if (!files.length) return;
                                        files.forEach(file => {
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                                const base64String = reader.result as string;
                                                const [mimeInfo, data] = base64String.split(';base64,');
                                                const mime = mimeInfo.split(':')[1] ?? "image/jpeg";
                                                setBranding((prev) => ({
                                                    ...prev,
                                                    banners: [...(prev.banners || []), { bannerData: data, bannerMime: mime }]
                                                }));
                                            };
                                            reader.readAsDataURL(file);
                                        });
                                    }}
                                />

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {(branding.banners || []).map((slide: BrandingBannerItem, index: number) => (
                                        <div key={index} className="relative aspect-[3/1] rounded-xl overflow-hidden group border border-border/40">
                                            <Image
                                                src={`data:${slide.bannerMime};base64,${slide.bannerData}`}
                                                alt={`Slide ${index + 1}`}
                                                fill
                                                unoptimized
                                                sizes="(max-width: 768px) 50vw, 33vw"
                                                className="object-cover"
                                            />
                                            {/* Overlay on hover */}
                                            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors duration-200">
                                                {/* Number badge */}
                                                <span className="absolute top-2 left-2 text-[10px] font-bold text-[color:var(--ui-fx-white)]/0 group-hover:text-[color:var(--ui-fx-white)] bg-foreground/0 group-hover:bg-foreground/50 rounded-md px-1.5 py-0.5 transition-all font-mono">
                                                    {index + 1}
                                                </span>
                                                {/* Delete button */}
                                                <button
                                                    type="button"
                                                    className="absolute top-2 right-2 h-6 w-6 bg-foreground/0 group-hover:bg-[color:var(--status-danger)]/90 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:bg-[color:var(--status-danger)]"
                                                    onClick={() => {
                                                        const newBanners = [...(branding.banners ?? [])];
                                                        newBanners.splice(index, 1);
                                                        setBranding({ ...branding, banners: newBanners });
                                                    }}
                                                >
                                                    <X className="h-3.5 w-3.5 text-[color:var(--ui-fx-white)]" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add button */}
                                    <button
                                        type="button"
                                        onClick={() => sliderInputRef.current?.click()}
                                        className="aspect-[3/1] rounded-xl border-2 border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/[0.03] transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer group"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-muted/40 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                            <Upload className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                        </div>
                                        <p className="text-[11px] font-medium text-muted-foreground/50 group-hover:text-primary transition-colors">
                                            Agregar
                                        </p>
                                    </button>
                                </div>

                                {(!branding.banners || branding.banners.length === 0) && (
                                    <p className="text-xs text-muted-foreground/60 text-center py-2">
                                        Aún no hay imágenes en el slider
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ── INFORMACIÓN ─────────────────────────────────── */}
            <section className="border border-border/50 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-border/30">
                    <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold tracking-tight">Información Básica</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-[26px]">Datos que aparecen en la tienda pública</p>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Store className="h-3 w-3" />
                                Nombre de la Tienda
                            </Label>
                            <Input
                                value={branding.businessName}
                                onChange={(e) => setBranding({ ...branding, businessName: e.target.value })}
                                placeholder="Ej: Mi Marca"
                                className="h-10 rounded-lg border-border/60 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" />
                                Dirección Física
                            </Label>
                            <Input
                                value={branding.address || ""}
                                onChange={(e) => setBranding({ ...branding, address: e.target.value })}
                                placeholder="Calle Verdadera 123"
                                className="h-10 rounded-lg border-border/60 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Phone className="h-3 w-3" />
                                Teléfono de Soporte
                            </Label>
                            <Input
                                value={branding.phone || ""}
                                onChange={(e) => setBranding({ ...branding, phone: e.target.value })}
                                placeholder="Para llamadas directas"
                                className="h-10 rounded-lg border-border/60 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" />
                                    Texto del Footer
                                </Label>
                            </div>
                            <Input
                                value={branding.footerText || ""}
                                onChange={(e) => setBranding({ ...branding, footerText: e.target.value })}
                                placeholder="© 2026 Mi Marca. Todos los derechos reservados."
                                className="h-10 rounded-lg border-border/60 text-sm"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── ESTILO DE MARCA ──────────────────────────────── */}
            <section className="border border-border/50 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-border/30">
                    <div className="flex items-center gap-2.5">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold tracking-tight">Estilo de Marca</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-[26px]">Colores y tipografía de tu tienda</p>
                </div>

                <div className="p-4 sm:p-6 space-y-8">

                    {/* Colores */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <ColorPalette
                            value={branding.primaryColor ?? resolveColorToken("--swatch-1")}
                            onChange={(c) => setBranding({ ...branding, primaryColor: c })}
                            label="Color Primario"
                            hint="Botones y acciones principales"
                        />
                        <ColorPalette
                            value={branding.secondaryColor ?? resolveColorToken("--swatch-2")}
                            onChange={(c) => setBranding({ ...branding, secondaryColor: c })}
                            label="Color Secundario"
                            hint="Fondos y acentos sutiles"
                        />
                    </div>

                    {/* DIVIDER */}
                    <div className="border-t border-border/30" />

                    {/* Tipografía */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Type className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-semibold">Tipografía</p>
                                <p className="text-xs text-muted-foreground">Fuente que se usará en toda la tienda</p>
                            </div>
                        </div>

                        <Popover open={fontOpen} onOpenChange={setFontOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={fontOpen}
                                    className="w-full justify-between rounded-lg h-10 border-border/60 text-sm font-medium"
                                >
                                    <span className="truncate">
                                        {branding.typography
                                            ? GOOGLE_FONTS.find((font) => font.id === branding.typography)?.name || branding.typography
                                            : "Inter (Por Defecto)"}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar fuente..." className="h-10 text-sm" />
                                    <CommandList className="max-h-[280px]">
                                        <CommandEmpty>No se encontraron tipografías.</CommandEmpty>
                                        {groupedFonts().map((group) => (
                                            <CommandGroup key={group.type} heading={group.type}>
                                                {group.fonts.map((font) => (
                                                    <CommandItem
                                                        key={font.id}
                                                        value={font.name}
                                                        onSelect={(currentValue) => {
                                                            const fontObj = GOOGLE_FONTS.find(f => f.name.toLowerCase() === currentValue.toLowerCase());
                                                            if (fontObj) setBranding({ ...branding, typography: fontObj.id });
                                                            setFontOpen(false);
                                                        }}
                                                        className="rounded-lg my-0.5 py-2 px-3 flex items-center justify-between cursor-pointer"
                                                    >
                                                        <span className="text-sm">{font.name}</span>
                                                        <Check className={cn(
                                                            "h-4 w-4 text-primary transition-opacity",
                                                            (branding.typography || 'Inter') === font.id ? "opacity-100" : "opacity-0"
                                                        )} />
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        ))}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        {/* Font preview */}
                        <div
                            className="mt-4 rounded-xl bg-muted/20 border border-border/30 p-6 select-none"
                            style={{ fontFamily: `"${branding.typography || 'Inter'}", sans-serif` }}
                        >
                            <p className="text-2xl font-bold leading-tight">
                                The quick brown fox jumps over the lazy dog
                            </p>
                            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                {branding.typography || 'Inter'} &mdash; ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
