"use client";

/**
 * TutorialButton.tsx
 * Componente reutilizable: botón + modal de tutorial para cualquier sección de settings.
 * Modal 100% responsive: funciona en cualquier tamaño de pantalla.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import {
    BookOpen, X, ChevronLeft, ChevronRight,
    CheckCircle2, XCircle, Info,
    Lock, Clock, Percent, ShoppingBag, Monitor,
    Palette, FileText, Scan, MessageCircle, Sparkles, Smartphone,
    PackageSearch, CalendarClock, BellRing, Activity, Users, Fingerprint,
    Zap, Image, Globe, Store, MapPin, CreditCard, Receipt, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TutorialStep } from "@/lib/tutorial-content";

const ICON_MAP: Record<string, React.ElementType> = {
    Lock, Clock, Percent, ShoppingBag, Monitor,
    Palette, FileText, Scan, MessageCircle, Sparkles, Smartphone,
    PackageSearch, CalendarClock, BellRing, Activity, Users, Fingerprint,
    Zap, Image, Globe, Store, MapPin, CreditCard, Receipt, Settings2,
    BookOpen,
};

// ─── Modal ─────────────────────────────────────────────────────────────────────
function TutorialModal({
    open,
    steps,
    onClose,
}: {
    open: boolean;
    steps: TutorialStep[];
    onClose: () => void;
}) {
    const [step, setStep] = React.useState(0);
    const [mounted, setMounted] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    useEffect_resetOnOpen(open, setStep, scrollRef);
    useEffect_scrollOnStep(step, scrollRef);
    useEffect_escapeKey(open, onClose);
    useEffect_bodyScroll(open);

    if (!mounted || !open || steps.length === 0) return null;

    const current = steps[step];
    const Icon = ICON_MAP[current.iconName] ?? BookOpen;
    const progress = ((step + 1) / steps.length) * 100;
    const isFirst = step === 0;
    const isLast = step === steps.length - 1;
    const positiveLines = current.example.on.split("\n").filter(l => l.trim() !== "");

    const modalNode = (
        /*
         * Overlay fijo que cubre TODA la pantalla.
         * Fondo semitransparente + backdrop-blur visible siempre.
         * El panel interno usa flex-col con 3 capas:
         *   [header fijo] + [contenido scroll] + [footer fijo]
         */
        <div
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            {/* Panel — intercepta clicks para no cerrar */}
            <div
                className="
                    relative w-full max-w-lg bg-card shadow-2xl flex flex-col
                    rounded-2xl
                    max-h-[92dvh] h-[min(92dvh,760px)]
                "
                onClick={e => e.stopPropagation()}
            >
                {/* Barra de progreso (muy top) */}
                <div className="h-1 w-full bg-muted rounded-t-2xl overflow-hidden shrink-0">
                    <div
                        className="h-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Header: label + botón X — siempre visible en el top */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Tutorial · {step + 1} / {steps.length}
                    </span>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="h-9 w-9 rounded-full bg-muted/70 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Contenido scrolleable */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4"
                >
                    {/* Ícono + título */}
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2.5 rounded-2xl shrink-0", current.bg)}>
                            <Icon className={cn("h-5 w-5", current.color)} />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight leading-snug">
                            {current.title}
                        </h3>
                    </div>

                    {/* Descripción */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {current.description}
                    </p>

                    {/* Caja de ejemplo */}
                    <div className="rounded-2xl bg-muted/40 border border-border/40 overflow-hidden">
                        <div className="px-4 py-2.5 bg-muted/50 border-b border-border/30">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                {current.example.label}
                            </span>
                        </div>
                        <div className="px-4 py-3 space-y-2.5">
                            {positiveLines.map((line, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <p className="text-sm leading-relaxed">{line}</p>
                                </div>
                            ))}
                            <div className="flex items-start gap-2.5 opacity-60">
                                <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                <p className="text-sm leading-relaxed">{current.example.off}</p>
                            </div>
                        </div>
                    </div>

                    {/* Tip */}
                    <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
                        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm text-primary/80 leading-relaxed">{current.tip}</p>
                    </div>

                    {/* Dots de paginación */}
                    <div className="flex items-center justify-center gap-2 py-1">
                        {steps.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setStep(i)}
                                aria-label={`Ir al paso ${i + 1}`}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-300",
                                    i === step ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/50"
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Footer — siempre fijo al fondo del panel */}
                <div className="flex items-center gap-3 px-5 py-3 md:py-4 border-t border-border/40 shrink-0 bg-card rounded-b-2xl">
                    <Button
                        variant="outline"
                        onClick={() => setStep(s => s - 1)}
                        disabled={isFirst}
                        className="flex-1 rounded-xl h-11 gap-1.5"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                    </Button>

                    {isLast ? (
                        <Button
                            onClick={onClose}
                            className="flex-1 rounded-xl h-11"
                        >
                            ¡Entendido! 🎉
                        </Button>
                    ) : (
                        <Button
                            onClick={() => setStep(s => s + 1)}
                            className="flex-1 rounded-xl h-11 gap-1.5"
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalNode, document.body);
}

// ─── Hooks extraídos (para claridad) ──────────────────────────────────────────
function useEffect_resetOnOpen(
    open: boolean,
    setStep: (n: number) => void,
    scrollRef: React.RefObject<HTMLDivElement | null>
) {
    React.useEffect(() => {
        if (open) {
            setStep(0);
            setTimeout(() => scrollRef.current?.scrollTo(0, 0), 50);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
}

function useEffect_scrollOnStep(step: number, scrollRef: React.RefObject<HTMLDivElement | null>) {
    React.useEffect(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);
}

function useEffect_escapeKey(open: boolean, onClose: () => void) {
    React.useEffect(() => {
        if (!open) return;
        const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", fn);
        return () => document.removeEventListener("keydown", fn);
    }, [open, onClose]);
}

function useEffect_bodyScroll(open: boolean) {
    React.useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);
}

// ─── Botón público ─────────────────────────────────────────────────────────────
export function TutorialButton({
    steps,
    label = "¿Cómo configurar?",
    className,
}: {
    steps: TutorialStep[];
    label?: string;
    className?: string;
}) {
    const [open, setOpen] = React.useState(false);

    return (
        <>
            <TutorialModal open={open} steps={steps} onClose={() => setOpen(false)} />
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                className={cn(
                    "gap-2 rounded-xl border-primary/30 text-primary",
                    "hover:bg-primary/5 hover:border-primary/50",
                    "shrink-0 transition-all font-medium",
                    className
                )}
                aria-label={label}
            >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
            </Button>
        </>
    );
}
