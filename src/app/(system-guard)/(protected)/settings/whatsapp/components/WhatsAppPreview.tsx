"use client";

import * as React from "react";
import { MessageCircle, Check, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Rich Preview Component to parse WhatsApp formatting
export const WhatsAppRichText = ({ text }: { text: string }) => {
    // Basic parser for *bold* and _italic_
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

interface WhatsAppPreviewProps {
    text: string;
    businessName?: string;
}

export function WhatsAppPreview({ text, businessName = "Tu Negocio" }: WhatsAppPreviewProps) {
    return (
        <div className="w-full max-w-[320px] relative">
            <div className="absolute inset-0 bg-emerald-500/10 blur-[80px] rounded-full animate-pulse" />

            <div className="relative aspect-[9/18.5] bg-[#e5ddd5] dark:bg-[#0b141a] rounded-[3rem] border-8 border-zinc-900 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col ring-4 ring-emerald-500/20">
                {/* WA Header */}
                <div className="bg-[#075e54] dark:bg-[#202c33] p-4 pt-10 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-zinc-400 border border-white/20" />
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-white leading-none">{businessName}</span>
                        <span className="text-[9px] text-white/70 mt-1">en línea</span>
                    </div>
                </div>

                {/* WA Body */}
                <div className="flex-1 p-3 overflow-y-auto space-y-4 pt-6">
                    <div className="flex justify-end">
                        <div className="bg-[#dcf8c6] dark:bg-[#005c4b] p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] relative animate-in slide-in-from-right-2 duration-300">
                            <p className="text-[11px] leading-relaxed text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                                <WhatsAppRichText text={text || "Aquí se verá la vista previa..."} />
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
    );
}
