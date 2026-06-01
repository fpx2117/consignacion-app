"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";

import { Separator } from "@/components/ui/separator";
import { Dock, DockIcon } from "@/components/ui/dock";
import { BorderBeam } from "@/components/ui/border-beam";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { BrandLogo } from "@/components/brand-logo";
import { NotificationsAnimatedPanel } from "@/components/notifications-panel";
import { SidebarDropdownGroup } from "@/components/sidebar/sidebar-dropdown-group";
import { SidebarIconLink } from "@/components/sidebar/sidebar-icon-link";
import type { SidebarNavItem } from "@/components/sidebar/types";

import { useNotifications, clearNotificationsCache } from "@/hooks/useNotifications";
import { useBroadcastChannel } from "@/hooks/useBroadcastChannel";
import { useSucursalStore } from "@/store/useSucursalStore";
import { apiService } from "@/lib/apiService";
import type { PlanLimits } from "@/lib/subscriptions/require-subscription";
import {
  Bell,
  ClipboardList,
  Handshake,
  History,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Sun,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

// Datos del usuario pasados desde el Server Component layout (evita el fetch duplicado)
export interface SidebarUserData {
  rol: "ADMIN" | "EMPLEADO";
  sucursalesPermitidas: { id: number; nombre: string; esPrincipal: boolean; activa: boolean }[];
  allowConsignaciones: boolean;
  activeSucursalId: number;
  planLimits: PlanLimits | null;
}

const NAV_CORE: SidebarNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];

const NAV_BUSINESS: SidebarNavItem[] = [
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Productos", href: "/productos", icon: Package },
  { label: "Pedidos Esperados", href: "/pedidos-esperados", icon: ClipboardList },
  { label: "Consignaciones", href: "/consignaciones", icon: Handshake },
  { label: "Gastos", href: "/gastos", icon: Wallet },
];

const NAV_ADMIN: SidebarNavItem[] = [
  { label: "Ajustes", href: "/settings", icon: Settings },
];

const MOBILE_PRIMARY: SidebarNavItem[] = [
  { label: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { label: "Vender", href: "/ventas/nueva", icon: ShoppingCart },
];

const QUICK_SALE: SidebarNavItem = {
  label: "Venta Casual",
  href: "/ventas/nueva",
  icon: ShoppingCart,
};

function NotificationButton({
  isMobile = false,
  notificationsState,
}: {
  isMobile?: boolean;
  notificationsState: ReturnType<typeof useNotifications>;
}) {
  const { hasUnread } = notificationsState;
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Notificaciones"
          className="relative flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Bell className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
          {hasUnread && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Notificaciones</SheetTitle>
        <NotificationsAnimatedPanel notificationsState={notificationsState} open={open} />
      </SheetContent>
    </Sheet>
  );
}

// Caché en memoria para pedidos vencidos (TTL: 60 s por sucursal)
const pedidosCache = new Map<number, { count: number; ts: number }>();
const PEDIDOS_TTL_MS = 60_000;

// Caché en memoria para configuración (TTL: 5 min)
let configCache: { value: boolean; ts: number } | null = null;
const CONFIG_TTL_MS = 5 * 60_000;

interface SidebarDockProps {
  /** Datos del usuario pre-cargados por el Server Component layout.
   *  Cuando se pasan, se elimina el fetch de /api/auth/me en el cliente. */
  initialUserData?: SidebarUserData;
}

export function SidebarDock({ initialUserData }: SidebarDockProps = {}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  const [themeMounted, setThemeMounted] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [userRole, _setUserRole] = React.useState<"ADMIN" | "EMPLEADO">(
    initialUserData?.rol ?? "ADMIN",
  );
  const [usarControlDeCaja, setUsarControlDeCaja] = React.useState(false);
  const [allowConsignaciones, _setAllowConsignaciones] = React.useState(
    initialUserData?.allowConsignaciones ?? true,
  );

  const notificationsState = useNotifications({ limit: 50 });

  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const hydrate = useSucursalStore((s) => s.hydrate);
  const pedidosVencidosCount = useSucursalStore((s) => s.pedidosVencidosCount);
  const setPedidosVencidosCount = useSucursalStore((s) => s.setPedidosVencidosCount);

  useBroadcastChannel({
    "sucursal-changed": () => {
      clearNotificationsCache();
      notificationsState.refresh();
      router.refresh();
    },
    "plan-changed": () => router.refresh(),
    "session-revoked": () => router.push("/login"),
  });

  const isDark = themeMounted && resolvedTheme === "dark";
  const themeButtonLabel = themeMounted
    ? isDark
      ? "Activar modo claro"
      : "Activar modo oscuro"
    : "Cambiar tema";
  const isEmpleado = userRole === "EMPLEADO";
  const isGlobalView = activeSucursalId === 0;

  const isActive = React.useCallback(
    (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href)),
    [pathname]
  );

  const handleLogout = React.useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiService.logout();
      router.push("/login");
    } catch {
      setLoggingOut(false);
    }
  }, [loggingOut, router]);

  const handleNavigate = React.useCallback(
    (href: string) => {
      router.push(href);
      setMobileMenuOpen(false);
    },
    [router]
  );

  const filteredBusiness = React.useMemo(() => {
    return NAV_BUSINESS.filter((item) => {
      if (item.href === "/consignaciones" && !allowConsignaciones) return false;
      return true;
    });
  }, [allowConsignaciones]);

  const operationsItems = React.useMemo(() => {
    const items: SidebarNavItem[] = [];
    if (usarControlDeCaja && !isGlobalView) {
      items.push({ label: "Historial", href: "/caja/historial", icon: History });
    }
    return items;
  }, [isGlobalView, usarControlDeCaja]);

  const mobileMenuItems = React.useMemo(() => {
    const items: SidebarNavItem[] = [...filteredBusiness];
    if (usarControlDeCaja && !isGlobalView) {
      items.push({ label: "Historial de Caja", href: "/caja/historial", icon: History });
    }
    items.push(...NAV_ADMIN);
    return items;
  }, [filteredBusiness, isGlobalView, usarControlDeCaja]);

  // Hidratar el store con datos del layout al montar
  React.useEffect(() => {
    if (initialUserData) {
      hydrate({
        activeSucursalId: initialUserData.activeSucursalId,
        availableSucursales: initialUserData.sucursalesPermitidas,
        planLimits: initialUserData.planLimits,
      });
    }
  }, [initialUserData, hydrate]);

  // Refrescar notificaciones cuando cambia la sucursal activa (mismo tab)
  const prevSucursalIdRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (prevSucursalIdRef.current !== null && prevSucursalIdRef.current !== activeSucursalId) {
      clearNotificationsCache();
      notificationsState.refresh();
    }
    prevSucursalIdRef.current = activeSucursalId;
  }, [activeSucursalId]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    setThemeMounted(true);
  }, []);

  React.useEffect(() => {
    const loadPedidosVencidos = async () => {
      const now = Date.now();
      const cached = pedidosCache.get(activeSucursalId);
      if (cached && now - cached.ts < PEDIDOS_TTL_MS) {
        setPedidosVencidosCount(cached.count);
        return;
      }

      try {
        const res = await fetch("/api/pedidos-esperados?estado=VENCIDO", {
          headers: Number.isFinite(activeSucursalId) && activeSucursalId >= 0
            ? { "x-sucursal-id": String(activeSucursalId) }
            : undefined,
          cache: "no-store",
        });

        if (!res.ok) return;

        const json = await res.json();
        const vencidos = (json?.data ?? []).filter(
          (pedido: { estado: string }) => pedido.estado === "VENCIDO",
        );
        const count = vencidos.length;
        pedidosCache.set(activeSucursalId, { count, ts: Date.now() });
        setPedidosVencidosCount(count);
      } catch {
      }
    };

    const cachedConfig = localStorage.getItem(`config-caja-${activeSucursalId}`);
    if (cachedConfig !== null) {
      setUsarControlDeCaja(cachedConfig === "true");
    }

    const loadConfig = async () => {
      const now = Date.now();
      if (configCache && now - configCache.ts < CONFIG_TTL_MS) {
        setUsarControlDeCaja(configCache.value);
        return;
      }

      try {
        const res = await apiService.getConfiguracionGeneral();
        const value = res?.usarControlDeCaja ?? true;
        configCache = { value, ts: Date.now() };
        setUsarControlDeCaja(value);
        localStorage.setItem(`config-caja-${activeSucursalId}`, String(value));
      } catch {
      }
    };

    const handleConfigChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ usarControlDeCaja: boolean }>;
      const value = Boolean(customEvent.detail?.usarControlDeCaja);
      // Invalidar caché al recibir cambios del sistema
      configCache = { value, ts: Date.now() };
      setUsarControlDeCaja(value);
    };

    loadPedidosVencidos();
    loadConfig();

    window.addEventListener("config-updated", handleConfigChange as EventListener);
    return () => window.removeEventListener("config-updated", handleConfigChange as EventListener);
  }, [activeSucursalId, setPedidosVencidosCount]);

  return (
    <aside className="fixed bottom-0 left-0 z-50 w-full border-t border-border/60 bg-background/75 backdrop-blur-2xl md:top-0 md:h-screen md:w-[88px] md:border-r md:border-t-0">
      <div className="md:hidden flex justify-center py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="relative overflow-hidden rounded-2xl p-[1px]">
          <Dock orientation="horizontal" className="border border-border/70 bg-card/70 backdrop-blur-xl gap-2 px-3">
            {isEmpleado
              ? (!isGlobalView ? <SidebarIconLink item={QUICK_SALE} active={isActive(QUICK_SALE.href)} isMobile tooltipSide="top" /> : null)
              : MOBILE_PRIMARY.filter((item) => !(isGlobalView && item.href === QUICK_SALE.href)).map((item) => (
                   <SidebarIconLink key={item.href} item={item} active={isActive(item.href)} isMobile tooltipSide="top" />
                 ))}

            {!isEmpleado && (
              <>
                <Separator orientation="vertical" className="h-5 mx-1 opacity-50" />
                <DockIcon>
                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                      <button
                        aria-label="Abrir menu principal"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </SheetTrigger>

                    <SheetContent side="bottom" className="rounded-t-[2.5rem] border-t p-6 pb-12">
                      <SheetHeader className="mb-6">
                        <SheetTitle className="text-left text-xl font-semibold tracking-tight">
                          Menu Principal
                        </SheetTitle>
                      </SheetHeader>

                      <div className="grid grid-cols-3 gap-3">
                        {mobileMenuItems.map((item) => {
                          const Icon = item.icon;
                          const active = isActive(item.href);
                          const isPedidos = item.href === "/pedidos-esperados";
                          const badgeCount = isPedidos ? pedidosVencidosCount : 0;

                          return (
                            <button
                              key={item.href}
                              onClick={() => handleNavigate(item.href)}
                              className="flex flex-col items-center gap-2 rounded-3xl bg-muted/35 p-3 transition-all active:scale-95"
                            >
                              <div className={`relative flex h-11 w-11 items-center justify-center rounded-2xl ${active ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}>
                                <Icon className="h-5 w-5" />
                                {badgeCount > 0 && (
                                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-[3px] rounded-full bg-destructive text-[9px] font-black text-destructive-foreground flex items-center justify-center leading-none">
                                    {badgeCount > 9 ? "9+" : badgeCount}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-center">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <Separator className="my-4 opacity-50" />

                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-3 rounded-2xl p-4 text-destructive transition-all hover:bg-destructive/10 active:scale-[0.98] disabled:opacity-50"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                          <LogOut className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-semibold">{loggingOut ? "Cerrando..." : "Cerrar Sesion"}</span>
                      </button>
                    </SheetContent>
                  </Sheet>
                </DockIcon>
              </>
            )}

            <Separator orientation="vertical" className="h-5 mx-1 opacity-50" />
            <DockIcon><NotificationButton isMobile notificationsState={notificationsState} /></DockIcon>

            <DockIcon>
              <button
                aria-label={themeButtonLabel}
                onClick={() => {
                  if (!themeMounted) return;
                  setTheme(isDark ? "light" : "dark");
                }}
                disabled={!themeMounted}
                className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </DockIcon>

            {isEmpleado && (
              <>
                <Separator orientation="vertical" className="h-5 mx-1 opacity-50" />
                <DockIcon>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleLogout}
                          disabled={loggingOut}
                          className="h-9 w-9 flex items-center justify-center rounded-full text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">{loggingOut ? "Cerrando..." : "Cerrar Sesion"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </DockIcon>
              </>
            )}
          </Dock>
          <BorderBeam size={50} duration={10} colorFrom="var(--primary)" colorTo="var(--ui-fx-cyan)" />
        </div>
      </div>

      <div className="hidden h-full w-full md:flex md:flex-col md:items-center md:py-6">
        <Link href="/dashboard" className="mb-8 transition-transform active:scale-95" aria-label="Ir al dashboard">
          <BrandLogo size="md" />
        </Link>

        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <div className="relative overflow-hidden rounded-3xl p-[1px]">
            <Dock orientation="vertical" className="border border-border/70 bg-card/75 shadow-xl backdrop-blur-xl md:flex-col gap-1.5 p-2">
              {isEmpleado ? (
                !isGlobalView ? <SidebarIconLink item={QUICK_SALE} active={isActive(QUICK_SALE.href)} /> : null
              ) : (
                <>
                  {NAV_CORE.map((item) => (
                    <SidebarIconLink key={item.href} item={item} active={isActive(item.href)} />
                  ))}

                  <Separator className="w-8 mx-auto opacity-50" />

                  <SidebarDropdownGroup
                    label="Negocio"
                    icon={Store}
                    items={filteredBusiness}
                    isActive={isActive}
                    onNavigate={handleNavigate}
                    getBadgeCount={(item) => (item.href === "/pedidos-esperados" ? pedidosVencidosCount : 0)}
                  />

                  {!isGlobalView ? <SidebarIconLink item={QUICK_SALE} active={isActive(QUICK_SALE.href)} /> : null}

                  {operationsItems.length > 0 && (
                    <SidebarDropdownGroup
                      label="Operaciones"
                      icon={Zap}
                      items={operationsItems}
                      isActive={isActive}
                      onNavigate={handleNavigate}
                    />
                  )}

                  <Separator className="w-8 mx-auto opacity-50" />

                  {NAV_ADMIN.map((item) => (
                    <SidebarIconLink key={item.href} item={item} active={isActive(item.href)} />
                  ))}
                </>
              )}

              <Separator className="w-8 mx-auto opacity-50" />
              <DockIcon><NotificationButton notificationsState={notificationsState} /></DockIcon>

              <DockIcon>
                <button
                  aria-label={themeButtonLabel}
                  onClick={() => {
                    if (!themeMounted) return;
                    setTheme(isDark ? "light" : "dark");
                  }}
                  disabled={!themeMounted}
                  className="h-10 w-10 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
                </button>
              </DockIcon>
            </Dock>

            <BorderBeam size={80} duration={15} colorFrom="var(--primary)" colorTo="var(--ui-fx-cyan)" />
          </div>
        </div>

        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label={loggingOut ? "Cerrando sesion" : "Cerrar sesion"}
                className="mt-auto mb-2 h-10 w-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <LogOut className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{loggingOut ? "Cerrando..." : "Cerrar Sesion"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="mb-4 text-[10px] font-semibold tracking-wide text-muted-foreground/30">v1.2</div>
      </div>
    </aside>
  );
}
