"use client";

import * as React from "react";
import { Sparkles, Smile, Bold, Italic, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
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
    showWhatsappNumber = false,
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

    const charCount = value.length;
    const maxRecommended = 1024;

    return (
        <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-5 py-3.5">
                <div className="flex items-center gap-3">
                    <Badge
                        variant="secondary"
                        className="bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)] border-[color:var(--status-success-strong)]/20 font-semibold text-xs"
                    >
                        {label}
                    </Badge>
                    <span className={cn(
                        "text-xs tabular-nums",
                        charCount > maxRecommended ? "text-[color:var(--status-warning)] font-medium" : "text-muted-foreground"
                    )}>
                        {charCount} / {maxRecommended}
                    </span>
                </div>

                {onMagicMessage && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMagicMessage}
                        className="h-8 cursor-pointer gap-1.5 rounded-lg text-[color:var(--status-warning)] hover:bg-[color:var(--status-warning)]/10 hover:text-[color:var(--status-warning)] transition-colors"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold">Generar mensaje</span>
                    </Button>
                )}
            </div>

            <CardContent className="p-0">
                {/* Toolbar */}
                <TooltipProvider delayDuration={300}>
                    <div className="flex items-center gap-1 border-b border-border/40 bg-muted/20 px-3 py-1.5">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 cursor-pointer rounded-md hover:bg-foreground/5"
                                    onClick={() => insertText("*", true)}
                                >
                                    <Bold className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Negrita (*texto*)</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 cursor-pointer rounded-md hover:bg-foreground/5"
                                    onClick={() => insertText("_", true)}
                                >
                                    <Italic className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Cursiva (_texto_)</TooltipContent>
                        </Tooltip>

                        <div className="mx-1.5 h-4 w-px bg-border/60" />

                        <Popover>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 cursor-pointer rounded-md hover:bg-foreground/5"
                                        >
                                            <Smile className="h-3.5 w-3.5" />
                                        </Button>
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">Insertar emoji</TooltipContent>
                            </Tooltip>
                            <PopoverContent
                                className="w-72 rounded-xl border border-border/60 bg-card p-3 shadow-xl"
                                align="start"
                                sideOffset={8}
                            >
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Emojis populares</p>
                                <div className="grid grid-cols-7 gap-0.5">
                                    {CURATED_EMOJIS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            onClick={() => insertText(emoji)}
                                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-lg transition-colors hover:bg-[color:var(--status-success-strong)]/10 active:scale-90"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </TooltipProvider>

                {/* Textarea */}
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="min-h-[200px] resize-none rounded-none border-0 bg-transparent px-5 py-4 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus-visible:ring-0"
                />

                {/* Variables section */}
                <div className="border-t border-border/40 px-5 py-4">
                    <div className="mb-3.5 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                            Variables dinamicas
                        </p>
                        <span className="text-xs text-muted-foreground">
                            Tocá para insertar
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {variables.map((v) => (
                            <button
                                key={v.value}
                                onClick={() => insertText(v.value)}
                                className="group cursor-pointer rounded-xl border border-[color:var(--status-success-strong)]/20 bg-[color:var(--status-success-strong)]/[0.06] p-3 text-left transition-all hover:border-[color:var(--status-success-strong)]/35 hover:bg-[color:var(--status-success-strong)]/10 active:scale-[0.99]"
                            >
                                <p className="text-sm font-semibold text-foreground">
                                    {v.label}
                                </p>
                                <div className="mt-1 inline-flex rounded-md border border-[color:var(--status-success-strong)]/25 bg-background/70 px-2 py-0.5">
                                    <code className="font-mono text-xs font-semibold text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)]">
                                        {v.value}
                                    </code>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* WhatsApp number field (only for Tienda tab) */}
                {showWhatsappNumber && onWhatsappNumberChange && (
                    <div className="border-t border-border/40 px-5 py-4">
                        <label className="mb-2.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 text-[color:var(--status-success-strong)]" />
                            Número de WhatsApp para pedidos
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 items-center rounded-lg border border-border/60 bg-muted/30 px-3 text-sm font-medium text-muted-foreground">
                                +54
                            </div>
                            <Input
                                type="tel"
                                value={whatsappNumber}
                                onChange={(e) => onWhatsappNumberChange(e.target.value)}
                                placeholder="9 11 2233 4455"
                                className="h-10 max-w-xs rounded-lg font-mono tabular-nums"
                            />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                            Este número recibe los mensajes de pedidos desde tu catálogo online.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
