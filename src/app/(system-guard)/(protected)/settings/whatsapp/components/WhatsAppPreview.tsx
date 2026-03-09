"use client";

import * as React from "react";
import { Check, CheckCheck, Mic, Smartphone } from "lucide-react";

// Rich Preview Component to parse WhatsApp formatting
export const WhatsAppRichText = ({ text }: { text: string }) => {
    const parts = text.split(/(\*[^*]+\*|_[^_]+_)/g);

    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith("*") && part.endsWith("*")) {
                    return <strong key={i} className="font-semibold">{part.slice(1, -1)}</strong>;
                }
                if (part.startsWith("_") && part.endsWith("_")) {
                    return <em key={i} className="italic">{part.slice(1, -1)}</em>;
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
};

interface WhatsAppPreviewProps {
    text: string;
    businessName?: string;
}

export function WhatsAppPreview({ text, businessName = "Tu Negocio" }: WhatsAppPreviewProps) {
    const timeNow = React.useMemo(() => {
        const d = new Date();
        return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    }, []);

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Label */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                <span className="font-medium">Vista previa en vivo</span>
            </div>

            {/* Phone frame */}
            <div className="relative w-full max-w-[300px]">
                {/* Glow effect */}
                <div className="pointer-events-none absolute inset-4 rounded-[2.5rem] bg-emerald-500/8 blur-2xl" />

                {/* Phone shell */}
                <div className="relative overflow-hidden rounded-[2.5rem] border-[6px] border-zinc-900 bg-zinc-900 shadow-2xl dark:border-zinc-800">
                    {/* Notch / Dynamic island */}
                    <div className="absolute left-1/2 top-2 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-zinc-900 dark:bg-zinc-800" />

                    {/* Screen */}
                    <div className="flex flex-col overflow-hidden rounded-[2rem] bg-[#e5ddd5] dark:bg-[#0b141a]" style={{ aspectRatio: "9/19" }}>
                        {/* WA Status bar */}
                        <div className="flex items-center justify-between bg-[#075e54] dark:bg-[#1f2c34] px-5 pb-0.5 pt-8 text-[8px] text-white/60">
                            <span>9:41</span>
                            <div className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
                                <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
                                <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
                            </div>
                        </div>

                        {/* WA Header */}
                        <div className="flex items-center gap-2.5 bg-[#075e54] px-3 py-2.5 dark:bg-[#1f2c34]">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-400/80 text-[10px] font-bold text-white">
                                {businessName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-semibold leading-tight text-white">
                                    {businessName}
                                </span>
                                <span className="text-[9px] leading-tight text-white/50">en línea</span>
                            </div>
                        </div>

                        {/* Chat area with wallpaper pattern */}
                        <div className="relative flex-1 overflow-y-auto px-2.5 py-3">
                            {/* Subtle wallpaper pattern overlay */}
                            <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMC41IiBmaWxsPSIjMDAwMDAwIiBmaWxsLW9wYWNpdHk9IjAuMDMiLz48L3N2Zz4=')] opacity-50 dark:opacity-20" />

                            {/* Date chip */}
                            <div className="mb-3 flex justify-center">
                                <span className="rounded-lg bg-white/70 px-3 py-0.5 text-[9px] font-medium text-zinc-500 shadow-sm dark:bg-[#1d2a31] dark:text-zinc-400">
                                    HOY
                                </span>
                            </div>

                            {/* Message bubble */}
                            <div className="flex justify-end">
                                <div className="relative max-w-[85%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-2.5 pb-1.5 pt-2 shadow-sm dark:bg-[#005c4b]">
                                    <p className="whitespace-pre-wrap text-[11px] leading-[1.45] text-zinc-800 dark:text-zinc-100">
                                        <WhatsAppRichText text={text || "Tu mensaje aparecerá aquí…"} />
                                    </p>
                                    <div className="mt-0.5 flex items-center justify-end gap-0.5">
                                        <span className="text-[8px] tabular-nums text-zinc-500/80 dark:text-white/35">
                                            {timeNow}
                                        </span>
                                        <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Input bar */}
                        <div className="flex items-center gap-1.5 bg-[#f0f2f5] px-2 py-1.5 dark:bg-[#1f2c34]">
                            <div className="flex h-9 flex-1 items-center rounded-full bg-white px-3 dark:bg-[#2a3942]">
                                <span className="text-[10px] text-zinc-400">Mensaje</span>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884]">
                                <Mic className="h-4 w-4 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Home indicator */}
                <div className="mx-auto mt-1 h-1 w-28 rounded-full bg-zinc-700" />
            </div>
        </div>
    );
}
