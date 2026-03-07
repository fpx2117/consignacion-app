"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorialButton } from "@/components/ui/tutorial-button";
import { WHATSAPP_TUTORIAL } from "@/lib/tutorial-content";

interface WhatsAppHeaderProps {
    onSave: () => void;
    saving: boolean;
}

export function WhatsAppHeader({ onSave, saving }: WhatsAppHeaderProps) {
    return (
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
                    <TutorialButton steps={WHATSAPP_TUTORIAL} />
                </div>
                <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
                    Personalizá los mensajes automáticos que tus clientes reciben por WhatsApp.
                    Diferenciá recordatorios de consignación de tickets de venta directa.
                </p>
            </div>

            <Button
                onClick={onSave}
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
    );
}
