"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes"; // <-- Vuelve el Theme

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
  Sun, // <-- Vuelve el sol
  Moon, // <-- Vuelve la luna
  ShoppingCart,
  Settings
} from "lucide-react";

import { useNotifications } from "../hooks/useNotifications";
import { NotificationsAnimatedPanel } from "@/components/notifications-panel";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Productos", href: "/productos", icon: Package },
  { label: "Consignaciones", href: "/consignaciones", icon: Handshake },
  { label: "Venta Casual (POS)", href: "/ventas/nueva", icon: ShoppingCart },
  { label: "Configuración", href: "/settings", icon: Settings },
] as const;

export function SidebarDock() {
  const pathname = usePathname() ?? "";
  
  // Lógica del Theme restaurada
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const NotificationItem = () => {
    const { hasUnread } = useNotifications();

    return (
      <Sheet>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <button
                type="button"
                className="relative flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full text-muted-foreground transition-all duration-300 hover:bg-muted hover:text-foreground"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                {hasUnread && (
                  <span className="absolute right-2 top-2 md:right-2.5 md:top-2.5 flex h-2 w-2 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
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
        <div className="flex w-full items-center justify-center px-1 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <TooltipProvider delayDuration={0}>
            <div className="relative overflow-hidden rounded-2xl p-[1px] max-w-[96vw]">
              
              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex items-center justify-center w-full">
                <Dock
                  orientation="horizontal"
                  direction="middle"
                  iconMagnification={40} 
                  iconDistance={0}
                  className="border bg-card/50 backdrop-blur-xl gap-1 px-2 min-w-max"
                >
                  {NAV.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;

                    return (
                      <DockIcon key={item.href} className="bg-transparent">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              aria-label={item.label}
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300",
                                active
                                  ? "bg-primary text-primary-foreground shadow-md"
                                  : "text-muted-foreground hover:bg-muted"
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="top" sideOffset={12} className="hidden sm:block">
                            <p>{item.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      </DockIcon>
                    );
                  })}

                  <Separator orientation="vertical" className="h-5 mx-0.5 opacity-50" />

                  <DockIcon className="bg-transparent">
                    <NotificationItem />
                  </DockIcon>

                  {/* FIX: Vuelve el botón de Theme en Móvil, ajustado al tamaño h-9 w-9 */}
                  <DockIcon className="bg-transparent">
                    <button
                      type="button"
                      onClick={() => setTheme(isDark ? "light" : "dark")}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {mounted ? (isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : null}
                    </button>
                  </DockIcon>

                </Dock>
              </div>
              
              <BorderBeam size={70} duration={10} borderWidth={1.5} colorFrom="var(--primary)" colorTo="#3b82f6" />
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* === DESKTOP LAYOUT (Vertical) === */}
      <div className="hidden h-full w-full md:flex md:flex-col md:items-center md:py-6">
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
                  const active = isActive(item.href);
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

                {/* FIX: Vuelve el botón de Theme en Escritorio */}
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