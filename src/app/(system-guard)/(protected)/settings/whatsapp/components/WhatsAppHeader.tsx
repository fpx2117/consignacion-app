"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorialButton } from "@/components/ui/tutorial-button";
import { WHATSAPP_TUTORIAL } from "@/lib/tutorial-content";

interface WhatsAppHeaderProps {
    onSave: () => void;
    saving: boolean;
}

export function WhatsAppHeader({ onSave, saving }: WhatsAppHeaderProps) {
    return (
        <header className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-[color:var(--status-success-strong)]/[0.03] p-6 md:p-8">
            {/* Decorative gradient orb */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[color:var(--status-success-strong)]/[0.07] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[color:var(--status-success-strong)]/[0.04] blur-3xl" />

            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                {/* Left side */}
                <div className="flex flex-col gap-4">
                    <Link
                        href="/settings"
                        className="group flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                        Configuración
                    </Link>

                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--status-success-strong)]/10 ring-1 ring-[color:var(--status-success-strong)]/20">
                            <MessageCircle className="h-6 w-6 text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                                    Mensajería WhatsApp
                                </h1>
                                <TutorialButton steps={WHATSAPP_TUTORIAL} />
                            </div>
                            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                                Personalizá los mensajes que reciben tus clientes. Consignaciones, ventas y pedidos de tienda.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save button */}
                <Button
                    onClick={onSave}
                    disabled={saving}
                    className="h-11 cursor-pointer gap-2 rounded-xl bg-[color:var(--status-success-strong)] px-6 font-semibold text-[color:var(--ui-fx-white)] shadow-lg shadow-emerald-600/20 transition-all hover:bg-[color:var(--status-success-strong)] hover:shadow-emerald-600/30 active:scale-[0.97] disabled:opacity-60"
                >
                    {saving ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Guardando…
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            Guardar cambios
                        </>
                    )}
                </Button>
            </div>
        </header>
    );
}
