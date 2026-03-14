/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// UI
import { Card } from "@/components/ui/card";

// Icons
import {
  Settings2,
  Palette,
  Store,
  Users,
  BellRing,
  MonitorSmartphone,
  ShieldCheck,
  ChevronRight,
  Lock,
  CreditCard,
  MessageCircle,
  Zap,
} from "lucide-react";

// Lista de configuraciones adaptada
const SETTINGS_MODULES = [
  {
    id: "tienda",
    title: "Tu Tienda Online",
    description: "Personalizá tu catálogo público: colores, banners, temas y redes sociales.",
    href: "/settings/tienda",
    icon: Zap,
    color: "text-[color:var(--status-warning)]",
    bg: "bg-[color:var(--status-warning)]/10",
    borderColor: "group-hover:border-[color:var(--status-warning)]/30",
    soon: false,
  },
  {
    id: "branding",
    title: "Branding y Reportes",
    description: "Personalizá el logo, colores y el diseño de los tickets de venta.",
    href: "/settings/branding",
    icon: Palette,
    color: "text-[color:var(--theme-ocean-primary)]",
    bg: "bg-[color:var(--theme-ocean-primary)]/10",
    borderColor: "group-hover:border-[color:var(--theme-ocean-primary)]/30",
    soon: false,
  },
  {
    id: "whatsapp",
    title: "Mensajería (WhatsApp)",
    description: "Configurá el número y el mensaje predeterminado para pedidos por WhatsApp en tu tienda.",
    href: "/settings/whatsapp",
    icon: MessageCircle,
    color: "text-[color:var(--status-success-strong)]",
    bg: "bg-[color:var(--status-success-strong)]/10",
    borderColor: "group-hover:border-[color:var(--status-success-strong)]/30",
    soon: false,
  },
  {
    id: "branches",
    title: "Sucursales y Depósitos",
    description: "Administrá los puntos de venta, ubicaciones y rangos de entrega.",
    href: "/settings/branches",
    icon: Store,
    color: "text-[color:var(--status-success-strong)]",
    bg: "bg-[color:var(--status-success-strong)]/10",
    borderColor: "group-hover:border-[color:var(--status-success-strong)]/30",
    soon: false,
  },

  {
    id: "pos",
    title: "Punto de Venta",
    description: "Configurá el comportamiento de la caja, cobros y stock en tiempo real.",
    href: "/settings/pos",
    icon: MonitorSmartphone,
    color: "text-[color:var(--status-warning)]",
    bg: "bg-[color:var(--status-warning)]/10",
    borderColor: "group-hover:border-[color:var(--status-warning)]/30",
    soon: false,
  },
  {
    id: "security",
    title: "Seguridad y Alertas",
    description: "Administrá accesos, revisá auditorías y configurá alertas de stock o ventas.",
    href: "/settings/security",
    icon: ShieldCheck,
    color: "text-muted-foreground",
    bg: "bg-muted/55",
    borderColor: "group-hover:border-border",
    soon: false,
  },
  {
    id: "plan",
    title: "Plan y Facturación",
    description: "Gestioná tu suscripción, revisá vencimientos y actualizá tus medios de pago.",
    href: "/settings/subscriptions",
    icon: CreditCard,
    color: "text-[color:var(--status-warning)]",
    bg: "bg-[color:var(--status-warning)]/10",
    borderColor: "group-hover:border-[color:var(--status-warning)]/30",
    soon: false,
  },
];

export default function SettingsPage() {
  const [allowSucursales, setAllowSucursales] = React.useState<boolean>(false); // Pessimistic default
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // 1. Carga inmediata desde caché para evitar flicker
    const cachedLimits = localStorage.getItem("subscription_limits");
    if (cachedLimits) {
      try {
        const limits = JSON.parse(cachedLimits);
        if (limits.allowSucursales !== undefined) {
          setAllowSucursales(limits.allowSucursales);
        }
      } catch (e) {
        console.error("Error parsing cached limits", e);
      }
    }

    const fetchUserData = async () => {
      try {
        const res = await fetch("/api/subscriptions/current");
        if (res.ok) {
          const json = await res.json();
          const limits = json?.subscription?.plan?.limits;

          if (limits) {
            const allow = limits.allowSucursales !== false;
            setAllowSucursales(allow);
            // 2. Guardar en caché para la próxima visita
            localStorage.setItem("subscription_limits", JSON.stringify({ allowSucursales: allow }));
          }
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, []);
  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-10 text-foreground selection:bg-primary/20">
      {/* HEADER */}
      <header className="space-y-3 text-center md:text-left">
        <div className="flex items-center gap-2 text-primary font-semibold tracking-wider uppercase text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20 mx-auto md:mx-0">
          <Settings2 className="h-3 w-3" />
          Panel de Control
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Administrá los parámetros generales de la plataforma. Seleccioná un módulo para ajustar sus preferencias.
        </p>
      </header>

      {/* GRID DE MÓDULOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SETTINGS_MODULES.map((module) => {
          const Icon = module.icon;
          // Si el módulo es el de sucursales y no tiene el plan, lo bloqueamos
          const isLocked = module.id === "branches" && !allowSucursales && !loading;
          const isSoon = module.soon || isLocked;

          // Contenido de la tarjeta (lo separamos para poder envolverlo en Link o en div)
          const CardContent = (
            <Card
              className={cn(
                "relative h-full border border-border/50 bg-card/40 backdrop-blur-xl shadow-lg rounded-[2rem] p-6 transition-all duration-300 overflow-hidden",
                isSoon
                  ? "opacity-60 bg-card/20 cursor-default" // Estilos para "Próximamente"
                  : "hover:shadow-2xl hover:bg-card/60 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer", // Estilos normales
                !isSoon && module.borderColor
              )}
            >
              {/* Badge de Próximamente / Bloqueado */}
              {isSoon && (
                <div className="absolute top-5 right-5 z-20 flex items-center gap-1.5 bg-muted/80 backdrop-blur-md border border-border/50 text-muted-foreground text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                  <Lock className="h-3 w-3" />
                  {isLocked ? "Plan Enterprise" : "Pronto"}
                </div>
              )}

              {/* Efecto de destello (solo si no es "soon") */}
              {!isSoon && (
                <div
                  className={cn(
                    "absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500",
                    module.bg
                  )}
                />
              )}

              <div className="relative z-10 flex flex-col h-full gap-4">
                {/* Icono y Flecha */}
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "h-12 w-12 rounded-2xl flex items-center justify-center border border-border/50 transition-colors",
                      isSoon ? "bg-muted text-muted-foreground grayscale" : cn(module.bg, module.color)
                    )}
                  >
                    <Icon className="h-6 w-6 stroke-[1.5px]" />
                  </div>

                  {/* Flecha (solo si no es "soon") */}
                  {!isSoon && (
                    <div className="h-8 w-8 rounded-full bg-background/50 flex items-center justify-center opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Textos */}
                <div className="space-y-1.5 flex-1">
                  <h2 className={cn(
                    "text-lg font-bold tracking-tight transition-colors",
                    isSoon ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                  )}>
                    {module.title}
                  </h2>
                  <p className="text-sm text-muted-foreground/80 leading-relaxed">
                    {module.description}
                  </p>
                </div>
              </div>
            </Card>
          );

          // Si el módulo es "Próximamente", no le ponemos Link para que no se pueda clickear
          if (isSoon) {
            return (
              <div key={module.href} className="block outline-none select-none">
                {CardContent}
              </div>
            );
          }

          // Si está activo, lo envolvemos en su Link correspondiente
          return (
            <Link key={module.href} href={module.href} className="block group outline-none">
              {CardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
