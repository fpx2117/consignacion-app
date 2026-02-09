"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Dock, DockIcon } from "@/components/ui/dock";
import { BorderBeam } from "@/components/ui/border-beam";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  LayoutDashboard,
  Users,
  Package,
  Handshake,
  Bell,
  Sun,
  Moon,
  ShoppingCart, // Nuevo icono para ventas
} from "lucide-react";

import { useNotifications } from "../hooks/useNotifications";
import { NotificationsAnimatedPanel } from "@/components/notifications-panel";

// Actualizamos la navegación para apuntar al POS (Punto de Venta)
const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Productos", href: "/productos", icon: Package },
  { label: "Consignaciones", href: "/consignaciones", icon: Handshake },
  { label: "Venta Casual (POS)", href: "/ventas/nueva", icon: ShoppingCart }, // Icono y ruta corregidos
] as const;

export function SidebarDock() {
  const pathname = usePathname() ?? "";
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  // Componente interno para el botón de notificaciones
  const NotificationItem = () => {
    const { hasUnread } = useNotifications();

    return (
      <Sheet>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground"
                aria-label="Notificaciones"
              >
                <Bell className="size-5" />
                {hasUnread && (
                  <span className="absolute right-2.5 top-2.5 flex h-2 w-2 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
                )}
              </button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={15}>
            <p>Notificaciones</p>
          </TooltipContent>
        </Tooltip>

        <SheetContent side="right" className="w-[350px] sm:w-[450px] p-0 border-l">
          <SheetHeader className="sr-only">
            <SheetTitle>Notificaciones</SheetTitle>
          </SheetHeader>
          <NotificationsAnimatedPanel />
        </SheetContent>
      </Sheet>
    );
  };

  return (
    <aside className="fixed bottom-0 left-0 z-50 w-full border-t bg-background/80 backdrop-blur-md md:top-0 md:h-screen md:w-[84px] md:border-r md:border-t-0">
      
      {/* === MOBILE LAYOUT (Horizontal) === */}
      <div className="md:hidden w-full">
        <div className="flex w-full items-center justify-center px-4 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <TooltipProvider>
            <div className="relative overflow-hidden rounded-2xl p-[1px]">
              <Dock
                orientation="horizontal"
                direction="middle"
                className="border bg-card/50 backdrop-blur-xl"
              >
                {NAV.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <DockIcon key={item.href}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            aria-label={item.label}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
                              active
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <Icon className="size-5" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={12}>
                          <p>{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </DockIcon>
                  );
                })}

                <Separator orientation="vertical" className="h-6 mx-1 opacity-50" />

                <DockIcon>
                  <NotificationItem />
                </DockIcon>

                <DockIcon>
                  <button
                    type="button"
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                  >
                    {mounted ? (isDark ? <Sun className="size-5" /> : <Moon className="size-5" />) : null}
                  </button>
                </DockIcon>
              </Dock>
              <BorderBeam size={70} duration={10} borderWidth={1.5} colorFrom="var(--primary)" colorTo="#3b82f6" />
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* === DESKTOP LAYOUT (Vertical) === */}
      <div className="hidden h-full w-full md:flex md:flex-col md:items-center md:py-6">
        {/* Logo / Brand Placeholder */}
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-6">
          <span className="text-xs font-bold text-primary">APP</span>
        </div>

        <div className="flex flex-1 items-center flex-col justify-center w-full">
          <TooltipProvider>
            <div className="relative overflow-hidden rounded-2xl p-[1px]">
              <Dock
                orientation="vertical"
                direction="middle"
                className="border bg-card/50 backdrop-blur-xl md:flex-col"
              >
                {NAV.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <DockIcon key={item.href}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            aria-label={item.label}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
                              active
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <Icon className="size-5" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={15}>
                          <p>{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </DockIcon>
                  );
                })}

                <Separator className="my-2 w-8 opacity-50 block" />

                <DockIcon>
                  <NotificationItem />
                </DockIcon>

                <DockIcon>
                  <button
                    type="button"
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                  >
                    {mounted ? (isDark ? <Sun className="size-5" /> : <Moon className="size-5" />) : null}
                  </button>
                </DockIcon>
              </Dock>
              <BorderBeam size={70} duration={10} borderWidth={1.5} colorFrom="var(--primary)" colorTo="#3b82f6" />
            </div>
          </TooltipProvider>
        </div>

        <div className="text-[10px] font-medium text-muted-foreground/40 mt-auto">v1.0</div>
      </div>
    </aside>
  );
}