"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AnimatedList } from "@/components/ui/animated-list";
import { useNotifications } from "@/hooks/useNotifications";
import { 
  Bell, 
  PackageX, 
  AlertTriangle, 
  Info, 
  Clock, 
  CheckCheck, 
  BellOff,
  CalendarX, // Icono para vencidos
  CalendarClock // Icono para por vencer
} from "lucide-react";
import { formatDistanceToNow } from "date-fns"; // Necesitarás: npm i date-fns
import { es } from "date-fns/locale";

// --- 1. Definimos los tipos coincidentes con el Backend ---
type NotificationType = 
  | "LOW_STOCK" 
  | "OUT_OF_STOCK" 
  | "EXPIRATION_NEAR" 
  | "PRODUCT_EXPIRED" 
  | "SYSTEM";

// --- Subcomponente: Item de Notificación ---
function NotificationItem({
  title,
  description,
  type,
  createdAt,
}: {
  title: string;
  description: string;
  type: string; // Lo dejamos string genérico para evitar crash si llega algo nuevo
  createdAt: string | Date;
}) {
  
  // Configuración visual expandida
  const styleConfig: Record<string, any> = {
    LOW_STOCK: {
      icon: AlertTriangle,
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-500",
      border: "border-amber-200/50 dark:border-amber-900/50",
    },
    OUT_OF_STOCK: {
      icon: PackageX,
      bg: "bg-red-500/10",
      text: "text-red-600 dark:text-red-500",
      border: "border-red-200/50 dark:border-red-900/50",
    },
    EXPIRATION_NEAR: {
      icon: CalendarClock,
      bg: "bg-orange-500/10",
      text: "text-orange-600 dark:text-orange-500",
      border: "border-orange-200/50",
    },
    PRODUCT_EXPIRED: {
      icon: CalendarX,
      bg: "bg-rose-900/10",
      text: "text-rose-700 dark:text-rose-500",
      border: "border-rose-200/50",
    },
    SYSTEM: {
      icon: Info,
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-500",
      border: "border-border",
    },
  };

  // Fallback seguro
  const config = styleConfig[type] || styleConfig.SYSTEM;
  const Icon = config.icon;

  // Formato de tiempo relativo (ej: "hace 5 min")
  const timeString = React.useMemo(() => {
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: es });
    } catch (e) {
      return "Reciente";
    }
  }, [createdAt]);

  return (
    <div
      className={cn(
        "group relative flex w-full cursor-default items-start gap-4 rounded-xl border p-3 md:p-4 transition-all duration-200",
        "bg-background/50 hover:bg-background hover:shadow-md",
        config.border
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10",
          config.bg,
          config.text
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground leading-none">
            {title}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground/70 capitalize">
            <Clock className="h-3 w-3" />
            {timeString}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

// --- Componente Principal ---
export function NotificationsAnimatedPanel({ className }: { className?: string }) {
  const { notifications, markAllAsRead, unreadCount, loading } = useNotifications();

  return (
    <div className={cn("flex h-full w-full flex-col overflow-hidden bg-muted/10", className)}>
      
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background px-6 py-5 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/20">
            <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-black animate-pulse" />
            )}
          </div>
          <div className="flex flex-col">
            <h2 className="text-base font-bold leading-none text-foreground">
              Actividad
            </h2>
            <span className="text-xs text-muted-foreground mt-1">
              {unreadCount > 0 ? (
                <span className="text-indigo-600 font-medium">{unreadCount} nuevas</span>
              ) : (
                "Todo sincronizado"
              )}
            </span>
          </div>
        </div>

        {/* Botón Marcar Leído */}
        <button
          onClick={() => markAllAsRead()} // Aseguramos que llame a la función correcta
          disabled={unreadCount === 0 || loading}
          title="Marcar todo como leído"
          className="group flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background transition-all hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <CheckCheck className="h-4 w-4 text-muted-foreground group-hover:text-indigo-600" />
        </button>
      </div>

      {/* Body con Scroll */}
      <div className="relative flex-1 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground animate-pulse bg-background/50">
            <div className="h-12 w-12 rounded-full bg-muted"></div>
            <div className="h-4 w-32 rounded bg-muted"></div>
          </div>
        ) : notifications.length === 0 ? (
          
          // Empty State
          <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background/50">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-muted to-transparent">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-sm border border-border/50">
                  <BellOff className="h-7 w-7 text-muted-foreground/40" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Estás al día
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-[240px] leading-relaxed">
              No hay notificaciones pendientes.
            </p>
          </div>

        ) : (
          <div className="h-full overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-muted-foreground/20">
             <div className="flex flex-col gap-3 pb-8"> 
              <AnimatedList delay={100}>
                {notifications.map((n) => (
  <NotificationItem
    key={n.id}
    title={n.title}
    description={n.description}
    type={n.type}
    // Usamos 'createdAt' que sí viene de la base de datos
    createdAt={n.createdAt} 
  />
))}
              </AnimatedList>
            </div>
          </div>
        )}

        {/* Sombra de scroll */}
        {notifications.length > 0 && (
           <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background via-background/80 to-transparent" />
        )}
      </div>
    </div>
  );
}