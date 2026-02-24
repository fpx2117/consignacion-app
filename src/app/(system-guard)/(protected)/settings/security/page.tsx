"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// UI
import { Card } from "@/components/ui/card";

// Icons
import {
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    Activity,
    Users,
    Fingerprint,
    BellRing,
} from "lucide-react";

const SECURITY_MODULES = [
    {
        title: "Registro de Actividad",
        description: "Revisá las acciones realizadas por los usuarios en el sistema.",
        href: "/settings/security/activity",
        icon: Activity,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
    },
    {
        title: "Registro de Empleados",
        description: "Gestioná el personal, sus accesos y permisos detallados.",
        href: "/settings/security/employees",
        icon: Users,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
    },
    {
        title: "Sesiones Activas",
        description: "Controlá los dispositivos que tienen acceso actual al sistema.",
        href: "/settings/security/sessions",
        icon: Fingerprint,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
    },
    {
        title: "Alertas del Sistema",
        description: "Configurá avisos de stock bajo, vencimientos y actividad de ventas.",
        href: "/settings/notifications",
        icon: BellRing,
        color: "text-pink-500",
        bg: "bg-pink-500/10",
    },
];

export default function SecurityPage() {
    return (
        <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-10 text-foreground selection:bg-primary/20">
            {/* HEADER */}
            <header className="space-y-3">
                <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Volver a Configuración
                </Link>
                <div className="flex items-center gap-2 text-primary font-semibold tracking-wider uppercase text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20">
                    <ShieldCheck className="h-3 w-3" />
                    Auditoría Central
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                    Seguridad y Auditoría
                </h1>
                <p className="text-sm text-muted-foreground max-w-2xl">
                    Monitoreá la integridad de tu negocio. Controlá quién accede, qué cambios se realizan y gestioná las sesiones activas en tiempo real.
                </p>
            </header>

            {/* GRID DE MÓDULOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {SECURITY_MODULES.map((module) => {
                    const Icon = module.icon;

                    return (
                        <Link key={module.href} href={module.href} className="block group outline-none">
                            <Card
                                className={cn(
                                    "relative h-full border border-border/50 bg-card/40 backdrop-blur-xl shadow-lg rounded-[2rem] p-6 transition-all duration-300 overflow-hidden",
                                    "hover:shadow-2xl hover:bg-card/60 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
                                )}
                            >
                                <div className="relative z-10 flex flex-col h-full gap-4">
                                    {/* Icono y Flecha */}
                                    <div className="flex items-center justify-between">
                                        <div
                                            className={cn(
                                                "h-12 w-12 rounded-2xl flex items-center justify-center border border-border/50 transition-colors",
                                                module.bg, module.color
                                            )}
                                        >
                                            <Icon className="h-6 w-6 stroke-[1.5px]" />
                                        </div>

                                        <div className="h-8 w-8 rounded-full bg-background/50 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </div>

                                    {/* Textos */}
                                    <div className="space-y-1.5 flex-1">
                                        <h2 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                                            {module.title}
                                        </h2>
                                        <p className="text-sm text-muted-foreground/80 leading-relaxed">
                                            {module.description}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
