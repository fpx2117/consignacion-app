"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// UI
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

// Icons
import {
    MessageCircle,
    ArrowLeft,
    Save,
    Sparkles,
    Smartphone,
    Check,
    Info,
    Package,
    ShoppingCart,
    Smile
} from "lucide-react";
import { apiService } from "@/lib/apiService";

const SMART_VARIABLES = [
    { label: "Nombre Cliente", value: "{name}", description: "Ej: Juan Pérez" },
    { label: "Link del Ticket/Remito", value: "{url}", description: "Link directo al PDF" },
    { label: "Total", value: "{total}", description: "Monto total de la operación" },
    { label: "Items", value: "{items}", description: "Cantidad de productos" },
    { label: "Fecha", value: "{date}", description: "Fecha de hoy" },
];

const CURATED_EMOJIS = [
    // Caras
    "🙂", "😄", "😉", "😎", "🤩", "🙌", "👍", "👋", "🙏",
    // Negocio
    "📱", "✉️", "📞", "💬", "📄", "💰", "💳", "🛒", "🛍️", "📦", "🏷️",
    // Símbolos
    "✅", "❌", "⚠️", "🔔", "📎", "📍", "⏱️", "⭐", "✨", "🚀", "🎁"
];

const MAGIC_TEMPLATES = {
    consignacion: [
        "*AllData POS - Notificación de Consignación*\n\nHola {name}, te enviamos el detalle de tu consignación.\n📄 *Ver Remito:* {url}\n\nGracias por confiar en nosotros! 🚀",
        "Estimado/a {name}, aquí tienes el link de tu consignación realizada hoy {date}.\n\n🔗 *Link:* {url}\n📦 *Items:* {items}\n\n_Tu negocio, siempre al día._",
        "Hola {name}! 👋 Te compartimos el remito digital de tu nueva consignación.\n\n💰 *Total Estimado:* {total}\n📄 *Documento:* {url}\n\nCualquier duda, estamos a disposición.",
    ],
    venta: [
        "*¡Gracias por tu compra, {name}!* 🎉\n\nTu ticket digital ya está disponible.\n💳 *Total:* {total}\n📄 *Ver Ticket:* {url}\n\nEsperamos verte pronto por aquí! ✨",
        "Hola {name}! Aquí tienes el comprobante de tu compra de hoy {date}.\n\n🛒 *Productos:* {items}\n💰 *Monto:* {total}\n🔗 {url}\n\n_AllData POS - Simplicidad en tu gestión._",
        "Ticket Digital - *AllData POS*\n\nHola {name}, adjuntamos tu ticket por la compra de *{items} items*.\n💵 *Total Final:* {total}\n✅ {url}\n\n¡Que tengas un excelente día!",
    ]
};

// Rich Preview Component to parse WhatsApp formatting
const WhatsAppRichText = ({ text }: { text: string }) => {
    // Basic parser for *bold* and _italic_
    // Split by * or _ while keeping the delimiters
    const parts = text.split(/(\*[^*]+\*|_[^_]+_)/g);

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('*') && part.endsWith('*')) {
                    return <strong key={i}>{part.slice(1, -1)}</strong>;
                }
                if (part.startsWith('_') && part.endsWith('_')) {
                    return <em key={i} className="italic">{part.slice(1, -1)}</em>;
                }
                return part;
            })}
        </>
    );
};

export default function WhatsAppSettingsPage() {
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // States for two templates
    const [templateConsignacion, setTemplateConsignacion] = React.useState("");
    const [templateVenta, setTemplateVenta] = React.useState("");
    const [activeTab, setActiveTab] = React.useState("consignacion");

    React.useEffect(() => {
        async function load() {
            try {
                const config = await apiService.getConfiguracionGeneral();
                setTemplateConsignacion(config?.mensajeWhatsappConsignacion || "");
                setTemplateVenta(config?.mensajeWhatsappVenta || "");
            } catch (e: any) {
                toast.error("Error al cargar configuración");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await apiService.actualizarConfiguracionGeneral({
                mensajeWhatsappConsignacion: templateConsignacion,
                mensajeWhatsappVenta: templateVenta,
            });
            toast.success("Plantillas de WhatsApp actualizadas correctamente.");
        } catch (e: any) {
            toast.error(e.message || "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const insertText = (text: string, isFormatting = false) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            // Fallback if ref is not ready
            if (activeTab === "consignacion") {
                setTemplateConsignacion(prev => prev + text);
            } else {
                setTemplateVenta(prev => prev + text);
            }
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentText = activeTab === "consignacion" ? templateConsignacion : templateVenta;

        let newText = "";
        if (isFormatting && start !== end) {
            // Wrap selection: *text*
            const selection = currentText.substring(start, end);
            newText = currentText.substring(0, start) + text + selection + text + currentText.substring(end);
        } else if (isFormatting && start === end) {
            // Insert pair and move cursor in middle? Or just insert one?
            // User said "it can't appear 1 solo" if they select all, 
            // but for a single click without selection, usually we insert a pair or just one.
            // Let's insert a pair if it's formatting and no selection.
            newText = currentText.substring(0, start) + text + text + currentText.substring(end);
        } else {
            // Normal insertion (variable or emoji)
            newText = currentText.substring(0, start) + text + currentText.substring(end);
        }

        if (activeTab === "consignacion") {
            setTemplateConsignacion(newText);
        } else {
            setTemplateVenta(newText);
        }

        // Restore focus and selection
        setTimeout(() => {
            textarea.focus();
            if (isFormatting && start === end) {
                textarea.setSelectionRange(start + text.length, start + text.length);
            } else if (isFormatting && start !== end) {
                textarea.setSelectionRange(start, end + (text.length * 2));
            } else {
                textarea.setSelectionRange(start + text.length, start + text.length);
            }
        }, 0);
    };

    const insertVariable = (variable: string) => insertText(variable);
    const insertEmoji = (emoji: string) => insertText(emoji);
    const insertFormatting = (symbol: string) => insertText(symbol, true);

    const generateMagicMessage = () => {
        const templates = activeTab === "consignacion" ? MAGIC_TEMPLATES.consignacion : MAGIC_TEMPLATES.venta;
        const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

        if (activeTab === "consignacion") {
            setTemplateConsignacion(randomTemplate);
        } else {
            setTemplateVenta(randomTemplate);
        }
        toast.success("¡Mensaje mágico generado!", {
            icon: <Sparkles className="h-4 w-4 text-amber-500" />
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                <p className="mt-4 text-muted-foreground animate-pulse">Cargando plantillas...</p>
            </div>
        );
    }

    // Preview Logic
    const getPreviewText = () => {
        const raw = activeTab === "consignacion" ? templateConsignacion : templateVenta;
        const defaultConsignacion = `*AllData POS - Remito*\n\nHola {name}.\n📄 Remito: {url}\n\n⏳ Válido 7 días • Máx 3 vistas`;
        const defaultVenta = `*AllData POS - Ticket*\n\nHola {name}, ¡Gracias por tu compra!\n📄 Ticket digital: {url}\n\n¡Te esperamos pronto!`;

        let text = raw || (activeTab === "consignacion" ? defaultConsignacion : defaultVenta);

        // Substitutions
        text = text
            .replace(/{name}/g, "Juan Pérez")
            .replace(/{url}/g, "https://alldata.pos/t/123xyz")
            .replace(/{total}/g, "$150,000")
            .replace(/{items}/g, "3")
            .replace(/{date}/g, new Date().toLocaleDateString('es-AR'));

        // Basic WhatsApp Formatting Simulation for Preview (Bold/Italic)
        // Note: Using a helper to render this in the actual UI might be better, 
        // but for now we'll return it and let the component handle basic string rendering.
        return text;
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-10 space-y-8 animate-in fade-in duration-500">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <Link
                        href="/settings"
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit group"
                    >
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Volver a Configuración
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                            <MessageCircle className="h-7 w-7 text-emerald-600" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
                            Mensajería avanzada
                        </h1>
                    </div>
                    <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
                        Personalizá los mensajes automáticos que tus clientes reciben por WhatsApp.
                        Diferenciá recordatorios de consignación de tickets de venta directa.
                    </p>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-12 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                >
                    {saving ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                        <>
                            <Save className="h-5 w-5 mr-2" />
                            Guardar Cambios
                        </>
                    )}
                </Button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* EDITOR TABS */}
                <div className="xl:col-span-12">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid grid-cols-2 w-full max-w-2xl h-14 bg-emerald-500/5 p-1 rounded-2xl border border-emerald-500/10 mb-6">
                            <TabsTrigger value="consignacion" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all duration-300">
                                <Package className="h-4 w-4" />
                                Remito de Consignación
                            </TabsTrigger>
                            <TabsTrigger value="venta" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all duration-300">
                                <ShoppingCart className="h-4 w-4" />
                                Ticket de Venta (POS)
                            </TabsTrigger>
                        </TabsList>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* EDITOR COLUMN */}
                            <div className="lg:col-span-7 space-y-6">
                                <Card className="rounded-[2.5rem] p-8 border hover:border-emerald-500/30 transition-all bg-card/50 overflow-hidden relative group">
                                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Sparkles className="h-24 w-24 text-emerald-600" />
                                    </div>

                                    <div className="relative z-10 flex flex-col gap-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-sm font-black uppercase tracking-widest text-emerald-600/80">
                                                    {activeTab === "consignacion" ? "Editar Plantilla de Consignación" : "Editar Plantilla de Venta POS"}
                                                </label>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Editor Inteligente</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={generateMagicMessage}
                                                    className="h-9 px-4 rounded-xl border-amber-500/20 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/40 gap-2 transition-all active:scale-95 group"
                                                >
                                                    <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" />
                                                    <span className="font-bold">Mensaje Mágico</span>
                                                </Button>
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3 font-mono font-bold">
                                                    FORMATO WA
                                                </Badge>
                                            </div>
                                        </div>

                                        <Textarea
                                            ref={textareaRef}
                                            value={activeTab === "consignacion" ? templateConsignacion : templateVenta}
                                            onChange={(e) => activeTab === "consignacion" ? setTemplateConsignacion(e.target.value) : setTemplateVenta(e.target.value)}
                                            placeholder={activeTab === "consignacion" ? "Ej: Hola {name}, te envío el remito de tu consignación..." : "Ej: ¡Hola {name}! Gracias por tu compra. Te adjunto tu ticket digital..."}
                                            className="min-h-[220px] text-lg leading-relaxed bg-background/30 border-none focus-visible:ring-0 resize-none p-0"
                                        />

                                        <div className="pt-6 border-t border-emerald-500/10 flex flex-col sm:flex-row gap-6">
                                            {/* Variables */}
                                            <div className="flex-1">
                                                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-tighter text-muted-foreground mb-4">
                                                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> Variables dinámicas
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {SMART_VARIABLES.map((v) => (
                                                        <button
                                                            key={v.value}
                                                            onClick={() => insertVariable(v.value)}
                                                            className="group flex flex-col items-start p-3 bg-white dark:bg-zinc-900 border border-emerald-500/10 hover:border-emerald-500/40 rounded-2xl transition-all hover:bg-emerald-500/5 text-left"
                                                        >
                                                            <span className="font-bold text-emerald-600 group-hover:scale-105 transition-transform">{v.value}</span>
                                                            <span className="text-[10px] text-muted-foreground mt-0.5">{v.label}</span>
                                                        </button>
                                                    ))}
                                                </div>

                                                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-tighter text-muted-foreground mb-4 mt-6">
                                                    <Smartphone className="h-3.5 w-3.5 text-emerald-500" /> Formato WhatsApp
                                                </p>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-xl border-emerald-500/10 hover:border-emerald-500/30"
                                                        onClick={() => insertFormatting("*")}
                                                    >
                                                        <span className="font-bold">B</span>
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-xl border-emerald-500/10 hover:border-emerald-500/30 font-serif italic"
                                                        onClick={() => insertFormatting("_")}
                                                    >
                                                        I
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Emojis */}
                                            <div className="flex-none sm:pt-7">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="h-[60px] rounded-2xl border-emerald-500/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 gap-2 px-6">
                                                            <Smile className="h-5 w-5 text-amber-500" />
                                                            <span className="font-bold">Emoji</span>
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[300px] p-4 rounded-[2rem] shadow-2xl border-emerald-500/20 bg-card/95 backdrop-blur-xl" align="end">
                                                        <div className="grid grid-cols-6 gap-2">
                                                            {CURATED_EMOJIS.map((emoji) => (
                                                                <button
                                                                    key={emoji}
                                                                    onClick={() => insertEmoji(emoji)}
                                                                    className="h-10 w-10 flex items-center justify-center text-xl hover:bg-emerald-500/10 rounded-xl transition-all active:scale-90"
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="rounded-3xl p-5 border-dashed bg-muted/20 flex gap-4 items-start">
                                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                                        <Info className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">Consejo Premium</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Los mensajes cortos tienen una tasa de apertura 3 veces mayor. Usá negritas con asteriscos <code className="bg-muted px-1 rounded">*texto*</code> para resaltar información clave.
                                        </p>
                                    </div>
                                </Card>
                            </div>

                            {/* PREVIEW COLUMN */}
                            <div className="lg:col-span-5 flex flex-col items-center justify-center lg:sticky lg:top-8">
                                <div className="w-full max-w-[320px] relative">
                                    <div className="absolute inset-0 bg-emerald-500/10 blur-[80px] rounded-full animate-pulse" />

                                    <div className="relative aspect-[9/18.5] bg-[#e5ddd5] dark:bg-[#0b141a] rounded-[3rem] border-8 border-zinc-900 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col ring-4 ring-emerald-500/20">

                                        {/* WA Header */}
                                        <div className="bg-[#075e54] dark:bg-[#202c33] p-4 pt-10 flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-zinc-400 border border-white/20" />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white leading-none">Tu Negocio</span>
                                                <span className="text-[9px] text-white/70 mt-1">en línea</span>
                                            </div>
                                        </div>

                                        {/* WA Body */}
                                        <div className="flex-1 p-3 overflow-y-auto space-y-4 pt-6">
                                            <div className="flex justify-end">
                                                <div className="bg-[#dcf8c6] dark:bg-[#005c4b] p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] relative animate-in slide-in-from-right-2 duration-300">
                                                    <p className="text-[13px] leading-relaxed text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                                                        <WhatsAppRichText text={getPreviewText()} />
                                                    </p>
                                                    <div className="flex justify-end items-center gap-1 mt-1">
                                                        <span className="text-[9px] text-zinc-500 dark:text-white/40">13:42</span>
                                                        <Check className="h-3 w-3 text-emerald-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* WA Footer */}
                                        <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-3 flex gap-2 items-center">
                                            <div className="h-8 flex-1 bg-white dark:bg-[#2a3942] rounded-full border border-border/50" />
                                            <div className="h-10 w-10 bg-[#00a884] rounded-full flex items-center justify-center text-white">
                                                <MessageCircle className="h-5 w-5" />
                                            </div>
                                        </div>

                                    </div>

                                    <div className="flex flex-col items-center mt-8 gap-4">
                                        <Badge variant="outline" className="h-8 px-4 rounded-full bg-background/50 border-emerald-500/20 text-emerald-600 gap-2 shadow-sm">
                                            <Smartphone className="h-3.5 w-3.5" /> Vista previa en vivo
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
