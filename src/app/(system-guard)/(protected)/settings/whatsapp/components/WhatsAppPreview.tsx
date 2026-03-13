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
                <div className="pointer-events-none absolute inset-4 rounded-[2.5rem] bg-[color:var(--status-success-strong)]/8 blur-2xl" />

                {/* Phone shell */}
                <div className="relative overflow-hidden rounded-[2.5rem] border-[6px] border-border bg-card shadow-2xl dark:border-border">
                    {/* Notch / Dynamic island */}
                    <div className="absolute left-1/2 top-2 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-card dark:bg-muted" />

                    {/* Screen */}
                    <div className="flex flex-col overflow-hidden rounded-[2rem] bg-[color:var(--wa-screen)] dark:bg-[color:var(--wa-screen-dark)]" style={{ aspectRatio: "9/19" }}>
                        {/* WA Status bar */}
                        <div className="flex items-center justify-between bg-[color:var(--wa-header)] dark:bg-[color:var(--wa-header-dark)] px-5 pb-0.5 pt-8 text-[8px] text-[color:var(--ui-fx-white)]/60">
                            <span>9:41</span>
                            <div className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-card/60" />
                                <div className="h-1.5 w-1.5 rounded-full bg-card/60" />
                                <div className="h-1.5 w-1.5 rounded-full bg-card/60" />
                            </div>
                        </div>

                        {/* WA Header */}
                        <div className="flex items-center gap-2.5 bg-[color:var(--wa-header)] px-3 py-2.5 dark:bg-[color:var(--wa-header-dark)]">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted-foreground/70 text-[10px] font-bold text-[color:var(--ui-fx-white)]">
                                {businessName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] font-semibold leading-tight text-[color:var(--ui-fx-white)]">
                                    {businessName}
                                </span>
                                <span className="text-[9px] leading-tight text-[color:var(--ui-fx-white)]/50">en línea</span>
                            </div>
                        </div>

                        {/* Chat area with wallpaper pattern */}
                        <div className="relative flex-1 overflow-y-auto px-2.5 py-3">
                            {/* Subtle wallpaper pattern overlay */}
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,hsl(var(--foreground)/0.12)_1px,transparent_1px)] bg-[length:14px_14px] opacity-35 dark:opacity-20" />

                            {/* Date chip */}
                            <div className="mb-3 flex justify-center">
                                <span className="rounded-lg bg-card/70 px-3 py-0.5 text-[9px] font-medium text-muted-foreground shadow-sm dark:bg-[color:var(--wa-chip-dark)] dark:text-muted-foreground/80">
                                    HOY
                                </span>
                            </div>

                            {/* Message bubble */}
                            <div className="flex justify-end">
                                <div className="relative max-w-[85%] rounded-xl rounded-tr-sm bg-[color:var(--wa-message)] px-2.5 pb-1.5 pt-2 shadow-sm dark:bg-[color:var(--wa-message-dark)]">
                                    <p className="whitespace-pre-wrap text-[11px] leading-[1.45] text-foreground dark:text-foreground">
                                        <WhatsAppRichText text={text || "Tu mensaje aparecerá aquí…"} />
                                    </p>
                                    <div className="mt-0.5 flex items-center justify-end gap-0.5">
                                        <span className="text-[8px] tabular-nums text-muted-foreground/80 dark:text-[color:var(--ui-fx-white)]/35">
                                            {timeNow}
                                        </span>
                                        <CheckCheck className="h-3 w-3 text-[color:var(--wa-check)]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Input bar */}
                        <div className="flex items-center gap-1.5 bg-[color:var(--wa-input)] px-2 py-1.5 dark:bg-[color:var(--wa-input-dark)]">
                            <div className="flex h-9 flex-1 items-center rounded-full bg-card px-3 dark:bg-[color:var(--wa-input-inner-dark)]">
                                <span className="text-[10px] text-muted-foreground/80">Mensaje</span>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--wa-mic)]">
                                <Mic className="h-4 w-4 text-[color:var(--ui-fx-white)]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Home indicator */}
                <div className="mx-auto mt-1 h-1 w-28 rounded-full bg-muted-foreground" />
            </div>
        </div>
    );
}
