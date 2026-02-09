"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AnimatedList } from "@/components/ui/animated-list";
import { useNotifications } from "@/hooks/useNotifications";
import { Bell, Package, AlertTriangle, Info, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";

function NotificationCard({
  title,
  description,
  type,
  time,
}: {
  title: string;
  description: string;
  type: "low_stock" | "out_of_stock" | "system";
  time: string;
}) {
  const Icon =
    type === "low_stock"
      ? AlertTriangle
      : type === "out_of_stock"
      ? Package
      : Info;

  return (
    <figure
      className={cn(
        "relative mx-auto w-full cursor-pointer overflow-hidden rounded-2xl p-4",
        "transition-all duration-200 ease-in-out hover:scale-[103%]",
        "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
        "transform-gpu dark:bg-transparent dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset] dark:backdrop-blur-md dark:[border:1px_solid_rgba(255,255,255,.1)]"
      )}
    >
      <div className="flex flex-row items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex flex-col overflow-hidden flex-1">
          <figcaption className="flex items-center gap-2 text-sm font-medium whitespace-pre dark:text-white">
            <span className="truncate">{title}</span>
            <span className="opacity-40">·</span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {time}
            </span>
          </figcaption>

          <p className="mt-1 text-sm font-normal text-muted-foreground line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </figure>
  );
}

export function NotificationsAnimatedPanel({ className }: { className?: string }) {
  const { notifications, markAsRead, hasUnread, unreadCount, loading } =
    useNotifications({
      onlyUnreadOnLoad: true, // ✅ para que veas historial + nuevas
      limit: 50,
    });

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b p-6">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Notificaciones</h2>

        {unreadCount > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-2 text-[10px] font-medium text-primary">
            {unreadCount}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-hidden p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">Todo está al día</p>
            <p className="text-xs text-muted-foreground">No tienes nuevas alertas.</p>
          </div>
        ) : (
          <div className="relative flex h-full flex-col overflow-hidden">
            <AnimatedList>
              {notifications.map((n, idx) => (
                <div key={`${n.id}-${idx}`} className="mb-2">
                  <NotificationCard
                    title={n.title}
                    description={n.description}
                    type={n.type}
                    time={n.time}
                  />
                  {idx < notifications.length - 1 && (
                    <Separator className="my-2 opacity-40" />
                  )}
                </div>
              ))}
            </AnimatedList>

            {/* Fade abajo como el ejemplo */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/10 p-4">
        <button
          onClick={markAsRead}
          className="w-full rounded-md py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5 hover:underline disabled:opacity-50"
          disabled={notifications.length === 0 || !hasUnread}
        >
          Marcar todo como leído
        </button>
      </div>
    </div>
  );
}
