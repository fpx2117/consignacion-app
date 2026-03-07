"use client";

import * as React from "react";
import { Sparkles, Smile, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CURATED_EMOJIS = [
    "🙂", "😄", "😉", "😎", "🤩", "🙌", "👍", "👋", "🙏",
    "📱", "✉️", "📞", "💬", "📄", "💰", "💳", "🛒", "🛍️", "📦", "🏷️",
    "✅", "❌", "⚠️", "🔔", "📎", "📍", "⏱️", "⭐", "✨", "🚀", "🎁"
];

interface Variable {
    label: string;
    value: string;
}

interface TemplateEditorProps {
    value: string;
    onChange: (val: string) => void;
    label: string;
    placeholder: string;
    variables: Variable[];
    onMagicMessage?: () => void;
    whatsappNumber?: string;
    onWhatsappNumberChange?: (val: string) => void;
    showWhatsappNumber?: boolean;
}

export function TemplateEditor({
    value,
    onChange,
    label,
    placeholder,
    variables,
    onMagicMessage,
    whatsappNumber,
    onWhatsappNumberChange,
    showWhatsappNumber = false
}: TemplateEditorProps) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const insertText = (text: string, isFormatting = false) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            onChange(value + text);
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        let newText = "";
        if (isFormatting && start !== end) {
            const selection = value.substring(start, end);
            newText = value.substring(0, start) + text + selection + text + value.substring(end);
        } else if (isFormatting && start === end) {
            newText = value.substring(0, start) + text + text + value.substring(end);
        } else {
            newText = value.substring(0, start) + text + value.substring(end);
        }

        onChange(newText);

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

    return (
        <Card className="rounded-[2.5rem] p-8 border hover:border-emerald-500/30 transition-all bg-card/50 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="h-24 w-24 text-emerald-600" />
            </div>

            <div className="relative z-10 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-black uppercase tracking-widest text-emerald-600/80">
                            {label}
                        </label>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Editor Inteligente</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {onMagicMessage && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onMagicMessage}
                                className="h-9 px-4 rounded-xl border-amber-500/20 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/40 gap-2 transition-all active:scale-95 group"
                            >
                                <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" />
                                <span className="font-bold">Mensaje Mágico</span>
                            </Button>
                        )}
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3 font-mono font-bold">
                            FORMATO WA
                        </Badge>
                    </div>
                </div>

                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="min-h-[220px] text-lg leading-relaxed bg-background/30 border-none focus-visible:ring-0 resize-none p-0"
                />

                {showWhatsappNumber && onWhatsappNumberChange && (
                    <div className="pt-4 border-t border-emerald-500/10 flex flex-col gap-3">
                        <label className="text-xs font-black uppercase tracking-widest text-emerald-600/80">
                            Número de WhatsApp para Pedidos
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl">
                                <Smartphone className="h-4 w-4 text-emerald-600" />
                            </div>
                            <input
                                type="text"
                                value={whatsappNumber}
                                onChange={(e) => onWhatsappNumberChange(e.target.value)}
                                placeholder="Ej: 5491122334455"
                                className="flex-1 bg-background/30 border-none focus-visible:ring-0 text-sm font-bold placeholder:text-muted-foreground/50"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">Este es el número que recibirá los mensajes de tus clientes desde el catálogo.</p>
                    </div>
                )}

                <div className="pt-6 border-t border-emerald-500/10 flex flex-col sm:flex-row gap-6">
                    <div className="flex-1">
                        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-tighter text-muted-foreground mb-4">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> Variables dinámicas
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {variables.map((v) => (
                                <button
                                    key={v.value}
                                    onClick={() => insertText(v.value)}
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
                                onClick={() => insertText("*", true)}
                            >
                                <span className="font-bold">B</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-emerald-500/10 hover:border-emerald-500/30 font-serif italic"
                                onClick={() => insertText("_", true)}
                            >
                                I
                            </Button>
                        </div>
                    </div>

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
                                            onClick={() => insertText(emoji)}
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
    );
}
