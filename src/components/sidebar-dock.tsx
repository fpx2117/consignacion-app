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
  ShoppingCart,
} from "lucide-react";

import { useNotifications } from "../hooks/useNotifications";
import { NotificationsAnimatedPanel } from "@/components/notifications-panel";

const NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Productos", href: "/productos", icon: Package },
  { label: "Consignaciones", href: "/consignaciones", icon: Handshake },
  { label: "Venta Casual (POS)", href: "/ventas/nueva", icon: ShoppingCart },
] as const;

export function SidebarDock() {
  const pathname = usePathname() ?? "";
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

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
        {/* Cambiamos padding: px-2 en lugar de px-4 para ganar espacio en pantallas de 393px */}
        <div className="flex w-full items-center justify-center px-2 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <TooltipProvider delayDuration={0}>
            {/* Quitamos overflow-hidden estricto si es posible, pero BorderBeam lo necesita.
                La clave es que el contenido interno NO crezca más allá del contenedor. */}
            <div className="relative overflow-hidden rounded-2xl p-[1px] max-w-full">
              
              <Dock
  orientation="horizontal"
  direction="middle"
  
  // CORRECCIÓN AQUÍ:
  // Usamos los nombres correctos según tu versión de la librería.
  // iconMagnification={40}: El tamaño máximo al tocar es 40px (igual al tamaño base).
  // iconDistance={0}: El radio del efecto es 0.
  // Esto anula el efecto de lupa para que no se desborde en móvil.
  iconMagnification={40} 
  iconDistance={0}
  
  className="border bg-card/50 backdrop-blur-xl gap-2 px-3"
>
                {NAV.map((item) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <DockIcon key={item.href} className="bg-transparent"> {/* bg-transparent fix */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            aria-label={item.label}
                            className={cn(
                              // Reducimos ligeramente tamaño base en móvil (h-9 w-9) si es necesario, 
                              // pero con magnification={40} el h-10 w-10 cabe justo en iPhone 14 Pro.
                              "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
                              active
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:bg-muted"
                            )}
                          >
                            <Icon className="size-5" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={12} className="hidden sm:block">
                          {/* Ocultamos tooltips en móvil touch para que no estorben */}
                          <p>{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </DockIcon>
                  );
                })}

                <Separator orientation="vertical" className="h-6 mx-0.5 opacity-50" />

                <DockIcon className="bg-transparent">
                  <NotificationItem />
                </DockIcon>

                <DockIcon className="bg-transparent">
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
      {/* Se mantiene con la animación completa (magnification default) porque hay espacio de sobra */}
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
                // En Desktop SÍ dejamos la animación por defecto
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