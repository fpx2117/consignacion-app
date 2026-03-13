/* eslint-disable */
// @ts-nocheck
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Instagram, Facebook, Youtube, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Validators ──
const isValidUrl = (val: string) => {
    if (!val) return null;
    try { new URL(val); return true; } catch { return false; }
};
const isValidPhone = (val: string) => {
    if (!val) return null;
    return /^\d{10,15}$/.test(val.replace(/\s/g, ''));
};

// ── SVG Icons (inline) ──
const TikTokIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("w-5 h-5", className)}>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("w-5 h-5", className)}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
);

// ── Channel config ──
interface ChannelConfig {
    id: string;
    label: string;
    icon: React.ReactNode;
    iconSmall: React.ReactNode;
    brandColor: string;
    bgClass: string;
    textClass: string;
    field: string;
    placeholder: string;
    validate: (v: string) => boolean | null;
    hint?: string;
    description?: string;
}

const SOCIAL_CHANNELS: ChannelConfig[] = [
    {
        id: "instagram",
        label: "Instagram",
        icon: <Instagram className="w-5 h-5" />,
        iconSmall: <Instagram className="w-3.5 h-3.5" />,
        brandColor: "var(--brand-instagram)",
        bgClass: "bg-[color:var(--brand-instagram)]/10",
        textClass: "text-[color:var(--brand-instagram)]",
        field: "instagramUrl",
        placeholder: "instagram.com/tu_tienda",
        validate: isValidUrl,
    },
    {
        id: "tiktok",
        label: "TikTok",
        icon: <TikTokIcon />,
        iconSmall: <TikTokIcon className="w-3.5 h-3.5" />,
        brandColor: "var(--brand-tiktok)",
        bgClass: "bg-foreground/8 dark:bg-card/10",
        textClass: "text-foreground dark:text-[color:var(--ui-fx-white)]",
        field: "tiktokUrl",
        placeholder: "tiktok.com/@tu_tienda",
        validate: isValidUrl,
    },
    {
        id: "facebook",
        label: "Facebook",
        icon: <Facebook className="w-5 h-5" />,
        iconSmall: <Facebook className="w-3.5 h-3.5" />,
        brandColor: "var(--brand-facebook)",
        bgClass: "bg-[color:var(--brand-facebook)]/10",
        textClass: "text-[color:var(--brand-facebook)]",
        field: "facebookUrl",
        placeholder: "facebook.com/tu_tienda",
        validate: isValidUrl,
    },
    {
        id: "youtube",
        label: "YouTube",
        icon: <Youtube className="w-5 h-5" />,
        iconSmall: <Youtube className="w-3.5 h-3.5" />,
        brandColor: "var(--brand-youtube)",
        bgClass: "bg-[color:var(--brand-youtube)]/10",
        textClass: "text-[color:var(--brand-youtube)]",
        field: "youtubeUrl",
        placeholder: "youtube.com/@tu_canal",
        validate: isValidUrl,
    },
];

const CONTACT_CHANNELS: ChannelConfig[] = [
    {
        id: "whatsapp",
        label: "WhatsApp",
        icon: <WhatsAppIcon />,
        iconSmall: <WhatsAppIcon className="w-3.5 h-3.5" />,
        brandColor: "var(--brand-whatsapp)",
        bgClass: "bg-[color:var(--brand-whatsapp)]/10",
        textClass: "text-[color:var(--brand-whatsapp)]",
        field: "whatsappNumber",
        placeholder: "5491122334455",
        validate: isValidPhone,
        hint: "Sin + ni espacios",
    },
    {
        id: "maps",
        label: "Google Maps",
        icon: <MapPin className="w-5 h-5" />,
        iconSmall: <MapPin className="w-3.5 h-3.5" />,
        brandColor: "hsl(var(--primary))",
        bgClass: "bg-primary/10",
        textClass: "text-primary",
        field: "googleMapsUrl",
        placeholder: "maps.app.goo.gl/tu-ubicacion",
        validate: isValidUrl,
        description: "Que tus clientes te encuentren",
    },
];

// ── Social Card ──
function SocialCard({
    channel,
    value,
    onChange,
}: {
    channel: ChannelConfig;
    value: string;
    onChange: (v: string) => void;
}) {
    const status = channel.validate(value);
    const isConnected = status === true;
    const isError = status === false;
    const [justConnected, setJustConnected] = React.useState(false);
    const prevStatus = React.useRef<boolean | null>(null);

    React.useEffect(() => {
        if (prevStatus.current !== true && status === true) {
            setJustConnected(true);
            const t = setTimeout(() => setJustConnected(false), 600);
            return () => clearTimeout(t);
        }
        prevStatus.current = status;
    }, [status]);

    return (
        <div className={cn(
            "group relative rounded-xl border bg-background p-4 transition-all duration-200",
            isConnected
                ? "border-[color:var(--status-success-strong)] dark:border-[color:var(--status-success-strong)]/50 shadow-sm shadow-emerald-500/5"
                : isError
                    ? "border-[color:var(--status-danger)] dark:border-[color:var(--status-danger)]/40"
                    : "border-border hover:border-border/80 hover:shadow-sm",
        )}>
            <div className="flex items-center gap-3 mb-3">
                {/* Icon with connected dot */}
                <div className="relative">
                    <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-300",
                        channel.bgClass,
                        channel.textClass,
                        justConnected && "scale-110",
                    )}>
                        {channel.icon}
                    </div>
                    {/* Connected dot */}
                    {isConnected && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--status-success-strong)] opacity-50" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-[color:var(--status-success-strong)] border-2 border-background" />
                        </span>
                    )}
                </div>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                    <Label className="text-sm font-semibold leading-none">{channel.label}</Label>
                    {channel.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{channel.description}</p>
                    )}
                </div>
            </div>

            {/* Input */}
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={channel.placeholder}
                className={cn(
                    "h-9 rounded-lg text-sm transition-all duration-200",
                    "bg-muted/40 border-transparent focus:bg-background focus:border-border",
                    isConnected && "border-[color:var(--status-success-strong)]/60 dark:border-[color:var(--status-success-strong)]/40 focus-visible:ring-[color:var(--status-success-strong)]/20",
                    isError && "border-[color:var(--status-danger)]/60 dark:border-[color:var(--status-danger)]/40 focus-visible:ring-[color:var(--status-danger)]/20",
                )}
            />

            {/* Error message (only on error) */}
            {isError && (
                <p className="text-[11px] text-[color:var(--status-danger)] dark:text-[color:var(--status-danger)] mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {channel.validate === isValidPhone
                        ? "Numero invalido. Usa solo digitos (10-15)."
                        : "URL invalida. Incluye https://"}
                </p>
            )}

            {/* Hint */}
            {channel.hint && !isError && (
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 font-mono">{channel.hint}</p>
            )}
        </div>
    );
}

// ── Connected Summary Bar ──
function ConnectedSummary({ branding }: { branding: any }) {
    const allChannels = [...SOCIAL_CHANNELS, ...CONTACT_CHANNELS];
    const connected = allChannels.filter(ch => {
        const val = branding[ch.field];
        return Boolean(val) && ch.validate(val) === true;
    });
    const total = allChannels.length;
    const count = connected.length;
    const percentage = Math.round((count / total) * 100);

    if (count === 0) return null;

    return (
        <div className="bg-background border border-border rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Top row: count + icons */}
            <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">{count}</span> de {total} canales
                </span>
                <div className="flex items-center gap-1">
                    {connected.map(ch => (
                        <div
                            key={ch.id}
                            title={ch.label}
                            className={cn(
                                "h-6 w-6 rounded-md flex items-center justify-center transition-all animate-in fade-in zoom-in-75 duration-300",
                                ch.bgClass,
                                ch.textClass,
                            )}
                        >
                            {ch.iconSmall}
                        </div>
                    ))}
                </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full bg-[color:var(--status-success-strong)] transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

// ── Main Export ──
export function SocialTab({ branding, setBranding }: any) {
    const handleChange = (field: string) => (value: string) => {
        setBranding({ ...branding, [field]: value });
    };

    return (
        <div className="space-y-6">
            {/* Redes sociales */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 mb-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        Redes sociales
                    </h3>
                    <div className="flex-1 h-px bg-border/50" />
                </div>
                <div className="grid gap-2">
                    {SOCIAL_CHANNELS.map(channel => (
                        <SocialCard
                            key={channel.id}
                            channel={channel}
                            value={branding[channel.field] || ""}
                            onChange={handleChange(channel.field)}
                        />
                    ))}
                </div>
            </div>

            {/* Contacto */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 px-1 mb-1">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        Contacto
                    </h3>
                    <div className="flex-1 h-px bg-border/50" />
                </div>
                <div className="grid gap-2">
                    {CONTACT_CHANNELS.map(channel => (
                        <SocialCard
                            key={channel.id}
                            channel={channel}
                            value={branding[channel.field] || ""}
                            onChange={handleChange(channel.field)}
                        />
                    ))}
                </div>
            </div>

            {/* Summary bar */}
            <ConnectedSummary branding={branding} />
        </div>
    );
}
