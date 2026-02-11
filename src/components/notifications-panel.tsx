"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AnimatedList } from "@/components/ui/animated-list";
import { useNotifications } from "@/hooks/useNotifications";
import { NOTIFICATION_TYPE, NOTIFICATION_CONFIG } from "@/lib/notificationes/notificaciones-types";
import { Button } from "@/components/ui/button"; // <--- CORRECCIÓN: Importación de Button
import { 
  Bell, 
  PackageX, 
  AlertTriangle, 
  Info, 
  Clock, 
  CheckCheck, 
  BellOff,
  CalendarX,
  CalendarClock,
  Trash2,
  Check,
  ShoppingBag
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const ICON_MAP: Record<string, any> = {
  [NOTIFICATION_TYPE.LOW_STOCK]: AlertTriangle,
  [NOTIFICATION_TYPE.OUT_OF_STOCK]: PackageX,
  [NOTIFICATION_TYPE.EXPIRATION_NEAR]: CalendarClock,
  [NOTIFICATION_TYPE.PRODUCT_EXPIRED]: CalendarX,
  [NOTIFICATION_TYPE.SYSTEM]: Info,
  [NOTIFICATION_TYPE.NEW_ORDER]: ShoppingBag,
  [NOTIFICATION_TYPE.PAYMENT_RECEIVED]: Check,
};

function NotificationItem({
  title,
  description,
  type,
  createdAt,
  read,
}: {
  title: string;
  description: string;
  type: string;
  createdAt: string | Date;
  read?: boolean; // Opcional por si el backend no lo envía aún
}) {
  const config = NOTIFICATION_CONFIG[type as NOTIFICATION_TYPE] || NOTIFICATION_CONFIG[NOTIFICATION_TYPE.SYSTEM];
  const Icon = ICON_MAP[type] || Info;

  const timeString = React.useMemo(() => {
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: es });
    } catch (e) { return "Reciente"; }
  }, [createdAt]);

  const severityStyles = {
    warning: "bg-amber-500/10 text-amber-600 border-amber-200/50 dark:border-amber-900/50",
    error: "bg-red-500/10 text-red-600 border-red-200/50 dark:border-red-900/50",
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-200/50 dark:border-emerald-900/50",
    info: "bg-blue-500/10 text-blue-600 border-blue-200/50 dark:border-blue-900/50",
  };

  return (
    <div className={cn(
      "group relative flex w-full items-start gap-4 rounded-xl border p-3 md:p-4 transition-all duration-200",
      read ? "opacity-50 grayscale-[0.3] bg-muted/20" : "bg-background shadow-sm hover:shadow-md",
      config.severity ? severityStyles[config.severity] : ""
    )}>
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10",
        read ? "bg-muted text-muted-foreground" : "bg-current/10"
      )}>
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

export function NotificationsAnimatedPanel({ className }: { className?: string }) {
  // CORRECCIÓN: Quitamos markAsRead porque no existe en tu hook
  const { notifications, markAllAsRead, unreadCount, loading } = useNotifications();
  
  // Estado local para "limpiar" visualmente las leídas si el backend no lo hace
  const [showRead, setShowRead] = React.useState(true);

  // Filtrado de notificaciones: mostramos las no leídas arriba
  const filteredNotifications = React.useMemo(() => {
    let list = [...notifications];
    if (!showRead) {
      list = list.filter(n => !n.read);
    }
    return list.sort((a, b) => {
      if (a.read === b.read) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return a.read ? 1 : -1;
    });
  }, [notifications, showRead]);

  return (
    <div className={cn("flex h-full w-full flex-col overflow-hidden bg-muted/10", className)}>
      
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b bg-background px-6 py-5 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/5">
            <Bell className="h-5 w-5 text-primary" />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-black animate-pulse" />
            )}
          </div>
          <div className="flex flex-col">
            <h2 className="text-base font-bold leading-none text-foreground">Actividad</h2>
            <span className="text-xs text-muted-foreground mt-1">
              {unreadCount > 0 ? `${unreadCount} pendientes` : "Al día"}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Botón para ocultar/mostrar leídas */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[10px] h-8 uppercase font-bold text-muted-foreground"
            onClick={() => setShowRead(!showRead)}
          >
            {showRead ? "Ocultar leídas" : "Mostrar todas"}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0 || loading}
            title="Marcar todo como leído"
          >
            <CheckCheck className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted"></div>
            <div className="h-3 w-24 rounded bg-muted"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background/50">
            <BellOff className="h-10 w-10 text-muted-foreground/20 mb-4" />
            <h3 className="text-sm font-semibold text-foreground">Sin novedades</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[180px]">
              No hay alertas que coincidan con tu filtro actual.
            </p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 space-y-3 scrollbar-hide">
            <AnimatedList delay={50}>
              {filteredNotifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  title={n.title}
                  description={n.description}
                  type={n.type}
                  createdAt={n.createdAt}
                  read={n.read}
                />
              ))}
            </AnimatedList>
            <div className="h-16" />
          </div>
        )}

        {filteredNotifications.length > 4 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>
    </div>
  );
}