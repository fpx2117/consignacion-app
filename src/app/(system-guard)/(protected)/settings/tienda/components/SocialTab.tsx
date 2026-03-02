import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Share2, Instagram, Facebook, Phone, Pin, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

// Validadores básicos
const isValidUrl = (val: string) => {
    if (!val) return null;
    try { new URL(val); return true; } catch { return false; }
};
const isValidPhone = (val: string) => {
    if (!val) return null;
    return /^\d{10,15}$/.test(val.replace(/\s/g, ''));
};

function SocialRow({
    id,
    label,
    icon,
    iconBg,
    value,
    onChange,
    placeholder,
    validate,
    hint,
}: {
    id: string;
    label: string;
    icon: React.ReactNode;
    iconBg: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    validate?: (v: string) => boolean | null;
    hint?: string;
}) {
    const status = validate ? validate(value) : null;
    const hasValue = Boolean(value);

    return (
        <div className="px-5 py-4 flex items-start gap-3 group">
            {/* Icon */}
            <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200",
                hasValue ? iconBg : "bg-muted"
            )}>
                <span className={cn("transition-opacity", hasValue ? "opacity-100" : "opacity-40")}>
                    {icon}
                </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-bold">{label}</Label>
                    {status === true && (
                        <Badge className="h-4 px-1.5 text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-none font-bold rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30 animate-in fade-in duration-200">
                            ✓ Conectado
                        </Badge>
                    )}
                    {status === false && (
                        <Badge className="h-4 px-1.5 text-[9px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-none font-bold rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 animate-in fade-in duration-200">
                            URL inválida
                        </Badge>
                    )}
                </div>
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cn(
                        "h-9 rounded-lg text-sm transition-all border",
                        "bg-muted/30 focus:bg-background",
                        status === true && "border-emerald-300 dark:border-emerald-800 focus-visible:ring-emerald-500/30",
                        status === false && value && "border-red-300 dark:border-red-800 focus-visible:ring-red-500/30"
                    )}
                />
                {hint && <p className="text-[10px] text-muted-foreground mt-1 font-mono">{hint}</p>}
            </div>
        </div>
    );
}

// TikTok SVG icon inline
const TikTokIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
);

export function SocialTab({ branding, setBranding }: any) {
    return (
        <div className="space-y-5">
            {/* ── REDES SOCIALES ── */}
            <section className="bg-background border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/60 bg-muted/20 flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Presencia Digital</h3>
                    <span className="text-[10px] text-muted-foreground ml-1">— Redes sociales</span>
                </div>

                <div className="divide-y divide-border/40">
                    <SocialRow
                        id="instagram"
                        label="Instagram"
                        icon={<Instagram className="w-4 h-4" />}
                        iconBg="bg-[#E1306C]/10 text-[#E1306C]"
                        value={branding.instagramUrl || ""}
                        onChange={(v) => setBranding({ ...branding, instagramUrl: v })}
                        placeholder="https://instagram.com/tu_tienda"
                        validate={isValidUrl}
                    />
                    <SocialRow
                        id="tiktok"
                        label="TikTok"
                        icon={<TikTokIcon />}
                        iconBg="bg-black/10 dark:bg-white/10 text-black dark:text-white"
                        value={branding.tiktokUrl || ""}
                        onChange={(v) => setBranding({ ...branding, tiktokUrl: v })}
                        placeholder="https://tiktok.com/@tu_tienda"
                        validate={isValidUrl}
                    />
                    <SocialRow
                        id="facebook"
                        label="Facebook"
                        icon={<Facebook className="w-4 h-4" />}
                        iconBg="bg-[#1877F2]/10 text-[#1877F2]"
                        value={branding.facebookUrl || ""}
                        onChange={(v) => setBranding({ ...branding, facebookUrl: v })}
                        placeholder="https://facebook.com/tu_tienda"
                        validate={isValidUrl}
                    />
                    <SocialRow
                        id="youtube"
                        label="YouTube"
                        icon={<Youtube className="w-4 h-4" />}
                        iconBg="bg-[#FF0000]/10 text-[#FF0000]"
                        value={branding.youtubeUrl || ""}
                        onChange={(v) => setBranding({ ...branding, youtubeUrl: v })}
                        placeholder="https://youtube.com/@tu_canal"
                        validate={isValidUrl}
                    />
                </div>
            </section>

            {/* ── CONTACTO DIRECTO ── */}
            <section className="bg-background border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/60 bg-muted/20 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Contacto Directo</h3>
                    <span className="text-[10px] text-muted-foreground ml-1">— WhatsApp y ubicación</span>
                </div>

                <div className="divide-y divide-border/40">
                    <SocialRow
                        id="whatsapp"
                        label="WhatsApp"
                        icon={
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                        }
                        iconBg="bg-[#25D366]/10 text-[#25D366]"
                        value={branding.whatsappNumber || ""}
                        onChange={(v) => setBranding({ ...branding, whatsappNumber: v })}
                        placeholder="5491122334455"
                        validate={isValidPhone}
                        hint="Sin + ni espacios · ej: 5491122334455"
                    />
                    <SocialRow
                        id="maps"
                        label="Google Maps"
                        icon={<Pin className="w-4 h-4" />}
                        iconBg="bg-primary/10 text-primary"
                        value={branding.googleMapsUrl || ""}
                        onChange={(v) => setBranding({ ...branding, googleMapsUrl: v })}
                        placeholder="Enlace de tu ubicación en Google Maps"
                        validate={isValidUrl}
                        hint="Opcional · Permite que tus clientes encuentren tu local"
                    />
                </div>
            </section>

            {/* Resumen de redes conectadas */}
            {[branding.instagramUrl, branding.tiktokUrl, branding.facebookUrl, branding.youtubeUrl, branding.whatsappNumber].filter(Boolean).length > 0 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border border-border rounded-xl animate-in fade-in duration-300">
                    <span className="text-[11px] text-muted-foreground">
                        <span className="font-black text-foreground">
                            {[branding.instagramUrl, branding.tiktokUrl, branding.facebookUrl, branding.youtubeUrl, branding.whatsappNumber, branding.googleMapsUrl].filter(Boolean).length}
                        </span>
                        {" "}de 6 canales configurados
                    </span>
                    <div className="ml-auto flex gap-1">
                        {branding.instagramUrl && <span title="Instagram" className="w-2 h-2 rounded-full bg-[#E1306C]" />}
                        {branding.tiktokUrl && <span title="TikTok" className="w-2 h-2 rounded-full bg-black dark:bg-white" />}
                        {branding.facebookUrl && <span title="Facebook" className="w-2 h-2 rounded-full bg-[#1877F2]" />}
                        {branding.youtubeUrl && <span title="YouTube" className="w-2 h-2 rounded-full bg-[#FF0000]" />}
                        {branding.whatsappNumber && <span title="WhatsApp" className="w-2 h-2 rounded-full bg-[#25D366]" />}
                        {branding.googleMapsUrl && <span title="Maps" className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                </div>
            )}
        </div>
    );
}
