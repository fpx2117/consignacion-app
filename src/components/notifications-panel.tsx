"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AnimatedList } from "@/components/ui/animated-list";
import { useNotifications } from "@/hooks/useNotifications";
import { NOTIFICATION_TYPE, NOTIFICATION_CONFIG } from "@/lib/notificationes/notificaciones-types";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "motion/react";
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
  Check,
  ShoppingBag,
  X,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const ICON_MAP: Record<string, LucideIcon> = {
  [NOTIFICATION_TYPE.LOW_STOCK]: AlertTriangle,
  [NOTIFICATION_TYPE.OUT_OF_STOCK]: PackageX,
  [NOTIFICATION_TYPE.EXPIRATION_NEAR]: CalendarClock,
  [NOTIFICATION_TYPE.PRODUCT_EXPIRED]: CalendarX,
  [NOTIFICATION_TYPE.SYSTEM]: Info,
  [NOTIFICATION_TYPE.NEW_ORDER]: ShoppingBag,
  [NOTIFICATION_TYPE.PAYMENT_RECEIVED]: Check,
  [NOTIFICATION_TYPE.CONSIGNMENT_ALERT]: Clock,
};

const SEVERITY_STYLES = {
  warning: {
    card: "border-amber-300/40 dark:border-amber-700/40",
    bar: "bg-amber-500",
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/20",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  error: {
    card: "border-red-300/40 dark:border-red-700/40",
    bar: "bg-red-500",
    icon: "bg-red-500/15 text-red-600 dark:text-red-400 ring-red-500/20",
    badge: "bg-red-500/10 text-red-700 dark:text-red-300",
  },
  success: {
    card: "border-emerald-300/40 dark:border-emerald-700/40",
    bar: "bg-emerald-500",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  info: {
    card: "border-sky-300/40 dark:border-sky-700/40",
    bar: "bg-sky-500",
    icon: "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/20",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
} as const;

function NotificationItem({
  title,
  description,
  type,
  createdAt,
  read,
  ventaId,
  consignacionId,
}: {
  title: string;
  description: string;
  type: string;
  createdAt: string | Date;
  read?: boolean;
  ventaId?: number;
  consignacionId?: number;
}) {
  const config = NOTIFICATION_CONFIG[type as NOTIFICATION_TYPE] || NOTIFICATION_CONFIG[NOTIFICATION_TYPE.SYSTEM];
  const Icon = ICON_MAP[type] || Info;
  const severity = config.severity || "info";
  const styles = SEVERITY_STYLES[severity];

  const timeString = React.useMemo(() => {
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: es });
    } catch { return "Reciente"; }
  }, [createdAt]);

  return (
    <div
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border p-3.5 transition-all duration-300 overflow-hidden",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20",
        read
          ? "opacity-60 bg-muted/30 border-transparent"
          : cn("bg-card shadow-sm", styles.card)
      )}
    >
      {/* Left accent bar */}
      {!read && (
        <div className={cn(
          "absolute left-0 top-0 h-full w-[3px] rounded-l-xl",
          styles.bar,
        )} />
      )}

      {/* Icon */}
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-all duration-300",
        read
          ? "bg-muted/60 text-muted-foreground ring-border"
          : styles.icon,
        "group-hover:scale-105"
      )}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-hidden min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              "text-sm font-semibold leading-tight truncate",
              read ? "text-muted-foreground" : "text-foreground"
            )}>
              {title}
            </span>
            {!read && (
              <span className={cn(
                "shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                styles.badge
              )}>
                {config.label}
              </span>
            )}
          </div>
        </div>
        <p className={cn(
          "line-clamp-2 text-xs leading-relaxed",
          read ? "text-muted-foreground/60" : "text-muted-foreground"
        )}>
          {description}
        </p>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-medium">
          <Clock className="h-2.5 w-2.5" />
          {timeString}
        </span>

        {/* Acciones adicionales */}
        {ventaId && type === NOTIFICATION_TYPE.NEW_ORDER && (
          <div className="mt-1 flex justify-start">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-[10px] px-3 font-semibold rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30 transition-colors"
              onClick={() => window.open(`/ticket-loading/${ventaId}`, '_blank')}
            >
              Ver Ticket
            </Button>
          </div>
        )}

        {consignacionId && type === NOTIFICATION_TYPE.CONSIGNMENT_ALERT && (
          <div className="mt-1 flex justify-start">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-[10px] px-3 font-semibold rounded-md bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30 transition-colors"
              onClick={() => window.open(`/dashboard/consignaciones/${consignacionId}`, '_blank')}
            >
              Ver Consignación
            </Button>
          </div>
        )}
      </div>

      {/* Unread dot */}
      {!read && (
        <span className="absolute right-3 top-3.5 h-2 w-2 rounded-full bg-primary shadow-sm shadow-primary/40" />
      )}
    </div>
  );
}

/* ─── Skeleton Item ─── */
function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 p-3.5 animate-pulse">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
      <div className="flex flex-1 flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-28 rounded-md bg-muted" />
          <div className="h-3 w-14 rounded-full bg-muted/60" />
        </div>
        <div className="h-3 w-full rounded-md bg-muted/70" />
        <div className="h-2.5 w-16 rounded-md bg-muted/40" />
      </div>
    </div>
  );
}

/* ─── Tab Filter ─── */
function FilterTabs({
  showAll,
  onToggle,
  unreadCount,
}: {
  showAll: boolean;
  onToggle: () => void;
  unreadCount: number;
}) {
  return (
    <div className="flex h-8 items-center rounded-lg bg-muted/50 p-0.5 text-xs font-semibold">
      <button
        onClick={() => showAll || onToggle()}
        className={cn(
          "relative h-full rounded-md px-3 transition-all duration-200",
          showAll
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Todas
      </button>
      <button
        onClick={() => !showAll || onToggle()}
        className={cn(
          "relative flex h-full items-center gap-1.5 rounded-md px-3 transition-all duration-200",
          !showAll
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        No leídas
        {unreadCount > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

/* ─── Main Panel ─── */
export function NotificationsAnimatedPanel({
  className,
  notificationsState: externalNotificationsState
}: {
  className?: string;
  notificationsState?: ReturnType<typeof useNotifications>;
}) {
  // Usamos el estado externo si se provee, sino (fallback) usamos el interno
  const internalNotificationsState = useNotifications();
  const activeState = externalNotificationsState || internalNotificationsState;
  const { notifications, markAllAsRead, unreadCount, loading } = activeState;

  const [showRead, setShowRead] = React.useState(true);

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
    <div className={cn("flex h-full w-full flex-col overflow-hidden", className)}>

      {/* ── Header ── */}
      <div className="relative shrink-0 border-b bg-gradient-to-b from-card to-background px-5 pb-4 pt-5">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-md shadow-destructive/30"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-none">Notificaciones</h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {unreadCount > 0
                  ? `${unreadCount} pendiente${unreadCount > 1 ? "s" : ""}`
                  : "Estás al día ✨"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => markAllAsRead()}
              disabled={unreadCount === 0 || loading}
              title="Marcar todo como leído"
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
            <SheetClose className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Cerrar</span>
            </SheetClose>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-4">
          <FilterTabs
            showAll={showRead}
            onToggle={() => setShowRead(!showRead)}
            unreadCount={unreadCount}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="relative flex-1 overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="flex flex-col gap-3 p-4">
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <BellOff className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Sin novedades</h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[200px] leading-relaxed">
              {showRead
                ? "No tienes notificaciones por ahora. ¡Todo en orden!"
                : "No hay alertas sin leer. Puedes ver todas las notificaciones cambiando el filtro."}
            </p>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 space-y-2.5 scrollbar-hide">
            <AnimatedList delay={40}>
              {filteredNotifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  title={n.title}
                  description={n.description}
                  type={n.type}
                  createdAt={n.createdAt}
                  read={n.read}
                  ventaId={n.ventaId}
                  consignacionId={n.consignacionId}
                />
              ))}
            </AnimatedList>
            <div className="h-16" />
          </div>
        )}

        {/* Bottom fade */}
        {filteredNotifications.length > 3 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background via-background/80 to-transparent" />
        )}
      </div>
    </div>
  );
}