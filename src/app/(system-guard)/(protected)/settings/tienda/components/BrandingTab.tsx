import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Palette, Trash2, FileText, Type, Check, ChevronsUpDown, Upload } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
    "#000000", "#171717", "#1e293b", "#dc2626",
    "#ea580c", "#16a34a", "#0284c7", "#0891b2",
    "#854d0e", "#db2777", "#7c3aed", "#4f46e5",
];

function SectionHeader({ step, icon: Icon, title, description }: {
    step: string; icon: React.ElementType; title: string; description?: string;
}) {
    return (
        <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground text-xs font-black shrink-0 mt-0.5 select-none">
                {step}
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black tracking-tight">{title}</h3>
                </div>
                {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
            </div>
        </div>
    );
}

export function BrandingTab({ branding, setBranding, handleImageUpload }: any) {
    const [fontOpen, setFontOpen] = React.useState(false);
    const [bannerDragOver, setBannerDragOver] = React.useState(false);

    // --- Refs para los inputs de archivo (evita labels con htmlFor que capturan clicks) ---
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
        <div className="space-y-6">

            {/* ── 01 — IMÁGENES ── */}
            <section className="bg-background border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60 bg-muted/20">
                    <SectionHeader step="01" icon={ImageIcon} title="Imágenes de la Tienda" description="Logo y banner que ven tus clientes" />
                </div>

                <div className="p-5 space-y-6">
                    {/* LOGO */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Logo del Negocio</p>
                        <div className="flex items-center gap-4">
                            {/* Preview */}
                            <div className="w-20 h-20 rounded-xl border-2 border-border flex items-center justify-center overflow-hidden shrink-0 bg-muted/30">
                                {branding.logoData ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={`data:${branding.logoMime};base64,${branding.logoData}`} alt="Logo" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <ImageIcon className="h-7 w-7 text-muted-foreground/30" />
                                )}
                            </div>
                            {/* Acciones */}
                            <div className="flex flex-col gap-2">
                                {/* Input oculto — activado vía ref */}
                                <input
                                    ref={logoInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, 'logo')}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg font-bold"
                                    onClick={() => logoInputRef.current?.click()}
                                >
                                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                                    {branding.logoData ? "Cambiar Logo" : "Subir Logo"}
                                </Button>
                                {branding.logoData && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="rounded-lg font-bold text-destructive hover:bg-destructive/10 h-7 text-xs"
                                        onClick={() => setBranding((prev: any) => ({ ...prev, logoData: null, logoMime: null }))}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                                    </Button>
                                )}
                                <p className="text-[10px] text-muted-foreground">PNG transparente · máx 20MB</p>
                            </div>
                        </div>
                    </div>

                    {/* TIPO BANNER */}
                    <div className="pt-5 border-t border-border/60">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de Banner</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Imagen única o carrusel animado</p>
                            </div>
                            <div className="flex p-1 bg-muted rounded-lg gap-1">
                                <button
                                    type="button"
                                    onClick={() => setBranding({ ...branding, isBannerSlider: false })}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                        !branding.isBannerSlider ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Única
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBranding({ ...branding, isBannerSlider: true })}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                        branding.isBannerSlider ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Slider
                                </button>
                            </div>
                        </div>

                        {/* Banner único */}
                        {!branding.isBannerSlider && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                {/* Input oculto — activado vía ref */}
                                <input
                                    ref={bannerInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, 'banner')}
                                />

                                {branding.bannerData ? (
                                    /* Banner cargado: preview + acciones */
                                    <div className="space-y-2">
                                        <div className="relative aspect-[21/9] rounded-xl overflow-hidden border border-border shadow-sm">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={`data:${branding.bannerMime};base64,${branding.bannerData}`} alt="Banner" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="rounded-lg font-bold text-xs"
                                                onClick={() => bannerInputRef.current?.click()}
                                            >
                                                <Upload className="h-3.5 w-3.5 mr-1.5" />Cambiar
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-lg font-bold text-xs text-destructive hover:bg-destructive/10"
                                                onClick={() => setBranding((prev: any) => ({ ...prev, bannerData: null, bannerMime: null }))}
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />Quitar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Drop zone vacía */
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Subir banner"
                                        className={cn(
                                            "aspect-[21/9] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all duration-200 cursor-pointer select-none",
                                            bannerDragOver
                                                ? "border-primary bg-primary/5 scale-[1.01]"
                                                : "border-border hover:border-primary/50 hover:bg-muted/30 text-muted-foreground hover:text-primary"
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
                                        <Upload className={cn("h-7 w-7 transition-transform", bannerDragOver && "scale-125 text-primary")} />
                                        <p className="text-xs font-bold">{bannerDragOver ? "Soltar aquí" : "Arrastrá o hacé clic para subir"}</p>
                                        <p className="text-[10px] opacity-60">1920×600px recomendado · JPG/PNG</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Slider */}
                        {branding.isBannerSlider && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                {/* Input oculto para slider */}
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
                                                const mime = mimeInfo.split(':')[1];
                                                setBranding((prev: any) => ({
                                                    ...prev,
                                                    banners: [...(prev.banners || []), { bannerData: data, bannerMime: mime }]
                                                }));
                                            };
                                            reader.readAsDataURL(file);
                                        });
                                    }}
                                />

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {(branding.banners || []).map((slide: any, index: number) => (
                                        <div key={index} className="relative aspect-[21/9] rounded-xl overflow-hidden group border border-border shadow-sm">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={`data:${slide.bannerMime};base64,${slide.bannerData}`} alt={`Slide ${index}`} className="w-full h-full object-cover" />
                                            <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-start p-1.5">
                                                <span className="text-[9px] font-black text-white/80 font-mono">#{index + 1}</span>
                                                <button
                                                    type="button"
                                                    className="h-5 w-5 bg-white/20 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                                                    onClick={() => {
                                                        const newBanners = [...branding.banners];
                                                        newBanners.splice(index, 1);
                                                        setBranding({ ...branding, banners: newBanners });
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3 text-white" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Botón agregar */}
                                    <button
                                        type="button"
                                        onClick={() => sliderInputRef.current?.click()}
                                        className="aspect-[21/9] rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer group"
                                    >
                                        <Upload className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                                        <p className="text-[10px] font-bold text-muted-foreground/60 group-hover:text-primary transition-colors">Agregar imágenes</p>
                                    </button>
                                </div>

                                {(!branding.banners || branding.banners.length === 0) && (
                                    <p className="text-[11px] text-muted-foreground text-center pb-2">Aún no hay imágenes en el slider</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ── 02 — INFORMACIÓN ── */}
            <section className="bg-background border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60 bg-muted/20">
                    <SectionHeader step="02" icon={FileText} title="Información Básica" description="Datos que aparecen en la tienda pública" />
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Nombre de la Tienda</Label>
                        <Input
                            value={branding.businessName}
                            onChange={(e) => setBranding({ ...branding, businessName: e.target.value })}
                            placeholder="Ej: Mi Marca"
                            className="h-10 rounded-lg border-border bg-muted/30 focus:bg-background text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Dirección Física</Label>
                        <Input
                            value={branding.address || ""}
                            onChange={(e) => setBranding({ ...branding, address: e.target.value })}
                            placeholder="Calle Verdadera 123"
                            className="h-10 rounded-lg border-border bg-muted/30 focus:bg-background text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Teléfono de Soporte</Label>
                        <Input
                            value={branding.phone || ""}
                            onChange={(e) => setBranding({ ...branding, phone: e.target.value })}
                            placeholder="Para llamadas directas"
                            className="h-10 rounded-lg border-border bg-muted/30 focus:bg-background text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-muted-foreground">Texto del Footer</Label>
                            <span className="text-[10px] font-mono text-muted-foreground/50">Mínimo 3 palabras</span>
                        </div>
                        <Input
                            value={branding.footerText || ""}
                            onChange={(e) => setBranding({ ...branding, footerText: e.target.value })}
                            placeholder="© 2026 Mi Marca. Todos los derechos reservados."
                            className="h-10 rounded-lg border-border bg-muted/30 focus:bg-background text-sm"
                        />
                    </div>
                </div>
            </section>

            {/* ── 03 — ESTILO ── */}
            <section className="bg-background border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border/60 bg-muted/20">
                    <SectionHeader step="03" icon={Palette} title="Estilo de Marca" description="Colores y tipografía" />
                </div>

                <div className="p-5 space-y-6">
                    {/* Color Primario */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold">Color Primario</p>
                                <p className="text-[11px] text-muted-foreground">Botones y acciones principales</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div
                                    className="relative w-8 h-8 rounded-lg border-2 border-border cursor-pointer overflow-hidden shadow-sm"
                                    style={{ backgroundColor: branding.primaryColor }}
                                    title="Abrir selector de color"
                                >
                                    <input
                                        type="color"
                                        value={branding.primaryColor}
                                        onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4"
                                    />
                                </div>
                                <Input
                                    type="text"
                                    value={branding.primaryColor}
                                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                                    className="font-mono rounded-lg h-8 w-24 text-xs uppercase tracking-wider text-center"
                                    maxLength={7}
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {COLOR_SWATCHES.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setBranding({ ...branding, primaryColor: c })}
                                    className={cn(
                                        "w-6 h-6 rounded-md border-2 transition-transform hover:scale-110",
                                        branding.primaryColor === c ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border/40"
                                    )}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Color Secundario */}
                    <div className="space-y-2 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold">Color Secundario</p>
                                <p className="text-[11px] text-muted-foreground">Fondos y banners sutiles</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div
                                    className="relative w-8 h-8 rounded-lg border-2 border-border cursor-pointer overflow-hidden shadow-sm"
                                    style={{ backgroundColor: branding.secondaryColor }}
                                >
                                    <input
                                        type="color"
                                        value={branding.secondaryColor}
                                        onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4"
                                    />
                                </div>
                                <Input
                                    type="text"
                                    value={branding.secondaryColor}
                                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                                    className="font-mono rounded-lg h-8 w-24 text-xs uppercase tracking-wider text-center"
                                    maxLength={7}
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {COLOR_SWATCHES.slice().reverse().map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setBranding({ ...branding, secondaryColor: c })}
                                    className={cn(
                                        "w-6 h-6 rounded-md border-2 transition-transform hover:scale-110",
                                        branding.secondaryColor === c ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border/40"
                                    )}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Tipografía */}
                    <div className="pt-4 border-t border-border/60">
                        <div className="flex items-center gap-2 mb-3">
                            <Type className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipografía</p>
                        </div>

                        <Popover open={fontOpen} onOpenChange={setFontOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={fontOpen}
                                    className="w-full justify-between rounded-lg h-10 bg-muted/30 border-border text-sm font-semibold"
                                >
                                    <span className="truncate">
                                        {branding.typography
                                            ? GOOGLE_FONTS.find((font) => font.id === branding.typography)?.name || branding.typography
                                            : "Inter (Por Defecto)"}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-2" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar fuente..." className="h-10 text-sm" />
                                    <CommandList className="max-h-[240px]">
                                        <CommandEmpty>No se encontraron tipografías.</CommandEmpty>
                                        <CommandGroup>
                                            {GOOGLE_FONTS.map((font) => (
                                                <CommandItem
                                                    key={font.id}
                                                    value={font.name}
                                                    onSelect={(currentValue) => {
                                                        const fontObj = GOOGLE_FONTS.find(f => f.name.toLowerCase() === currentValue.toLowerCase());
                                                        if (fontObj) setBranding({ ...branding, typography: fontObj.id });
                                                        setFontOpen(false);
                                                    }}
                                                    className="rounded-lg my-0.5 py-2.5 px-3 flex items-center justify-between cursor-pointer"
                                                >
                                                    <div>
                                                        <span className="text-sm font-medium block">{font.name}</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{font.type}</span>
                                                    </div>
                                                    <Check className={cn(
                                                        "h-4 w-4 text-primary transition-opacity",
                                                        (branding.typography || 'Inter') === font.id ? "opacity-100" : "opacity-0"
                                                    )} />
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        <div className="mt-3 p-4 rounded-xl bg-muted/30 border border-border flex flex-col items-center justify-center gap-1 pointer-events-none select-none">
                            <span className="text-3xl font-bold leading-none" style={{ fontFamily: `"${branding.typography || 'Inter'}", sans-serif` }}>
                                Aa
                            </span>
                            <span className="text-sm text-muted-foreground" style={{ fontFamily: `"${branding.typography || 'Inter'}", sans-serif` }}>
                                {branding.typography || 'Inter'} — Texto de muestra
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
