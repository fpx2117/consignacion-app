/* eslint-disable */
// @ts-nocheck
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useSucursalStore } from "@/store/useSucursalStore";

import {
  LayoutDashboard,
  Users,
  Package,
  Handshake,
  Bell,
  Sun,
  Moon,
  ShoppingCart,
  Settings,
  History,
  LayoutGrid,
  LogOut,
  Wallet,
  ClipboardList,
  Briefcase,
  Zap,
} from "lucide-react";

import { useNotifications } from "../hooks/useNotifications";
import { NotificationsAnimatedPanel } from "@/components/notifications-panel";
import { apiService } from "@/lib/apiService";

// --- CONFIGURACIÓN DE NAVEGACIÓN ---
const NAV_CORE = [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }];

const NAV_BUSINESS = [
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Productos", href: "/productos", icon: Package },
  { label: "Pedidos Esperados", href: "/pedidos-esperados", icon: ClipboardList },
  { label: "Consignaciones", href: "/consignaciones", icon: Handshake },
  { label: "Gastos", href: "/gastos", icon: Wallet },
];

const NAV_ADMIN = [{ label: "Ajustes", href: "/settings", icon: Settings }];

const MOBILE_PRIMARY = [
  { label: "Inicio", href: "/dashboard", icon: LayoutDashboard },
  { label: "Vender", href: "/ventas/nueva", icon: ShoppingCart },
];

import { BrandLogo } from "@/components/brand-logo";

// --- HOOK: Popover controlado por hover ---
function useHoverPopover(delay = 100) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), delay);
  };

  const onMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const onMouseLeave = () => {
    scheduleClose();
  };

  const onFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const onBlur = (e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      scheduleClose();
    }
  };

  React.useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  return { open, setOpen, onMouseEnter, onMouseLeave, onFocus, onBlur };
}

// --- COMPONENTE: Grupo de navegación con Popover hover ---
function NavGroup({
  label,
  icon: GroupIcon,
  items,
  isActive,
  renderSubItem,
  badge,
}: {
  label: string;
  icon: React.ElementType;
  items: any[];
  isActive: (href: string) => boolean;
  renderSubItem: (item: any) => React.ReactNode;
  badge?: number;
}) {
  const { open, setOpen, onMouseEnter, onMouseLeave, onFocus, onBlur } = useHoverPopover(150);
  const groupActive = items.some((i) => isActive(i.href));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onFocus={onFocus} onBlur={onBlur}>
          <DockIcon>
            <button
              aria-label={label}
              aria-expanded={open}
              aria-haspopup="menu"
              className={cn(
                "relative flex items-center justify-center rounded-full transition-all duration-300 h-10 w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                groupActive
                  ? "bg-primary text-primary-foreground shadow-lg scale-110"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <GroupIcon className="size-5" />
              {/* Badge de grupo activo */}
              {groupActive && !open && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary-foreground/70" />
              )}
              {/* Badge numérico externo */}
              {badge && badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-[3px] rounded-full bg-destructive text-[9px] font-black text-destructive-foreground flex items-center justify-center leading-none animate-pulse">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          </DockIcon>
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="center"
        sideOffset={12}
        className="p-2.5 w-auto min-w-[210px] rounded-2xl border border-border/70 bg-background/95 backdrop-blur-xl shadow-2xl"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <div className="flex flex-col gap-0.5">
          {items.map(renderSubItem)}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SidebarDock() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Hook unificado de notificaciones para evitar múltiples polling
  const notificationsState = useNotifications({ limit: 50 });

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiService.logout();
      router.push("/login");
    } catch {
      setLoggingOut(false);
    }
  };

  const { availableSucursales, activeSucursalId, setActiveSucursalId, setAvailableSucursales, pedidosVencidosCount, setPedidosVencidosCount } = useSucursalStore();

  // Flag de hidratación: Vital para evitar fallos Next.js
  const [mounted, setMounted] = React.useState(false);

  // Rol del usuario autenticado
  const [userRole, setUserRole] = React.useState<"ADMIN" | "EMPLEADO" | null>(null);
  const isEmpleado = userRole === "EMPLEADO";

  // Inicia explícitamente en falso para que NUNCA aparezca por error al inicio.
  const [usarControlDeCaja, setUsarControlDeCaja] = React.useState<boolean>(false);

  // Permisos de suscripción
  const [allowConsignaciones, setAllowConsignaciones] = React.useState<boolean>(true);

  React.useEffect(() => {
    setMounted(true);

    // 0. Obtener rol y permisos del usuario autenticado
    const fetchUserData = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const json = await res.json();
          const userData = json?.data;
          setUserRole(userData?.rol ?? "ADMIN");

          // Sincronizar sucursales
          if (userData?.sucursalesPermitidas && Array.isArray(userData.sucursalesPermitidas)) {
            setAvailableSucursales(userData.sucursalesPermitidas);
          }

          // Extraer límite de consignaciones del plan
          const limits = userData?.subscription?.plan?.limits;
          if (limits) {
            setAllowConsignaciones(limits.allowConsignaciones !== false);
          }
        }
      } catch { /* silencioso */ }
    };
    fetchUserData();

    // 1a. Cargar conteo de pedidos vencidos para badge en sidebar
    const fetchPedidosVencidos = async () => {
      try {
        const res = await fetch("/api/pedidos-esperados?estado=VENCIDO", {
          headers: activeSucursalId
            ? { "x-sucursal-id": String(activeSucursalId) }
            : undefined,
        });
        if (res.ok) {
          const json = await res.json();
          const vencidos = (json?.data ?? []).filter((p: any) => p.estado === "VENCIDO");
          setPedidosVencidosCount(vencidos.length);
        }
      } catch { /* silencioso */ }
    };
    fetchPedidosVencidos();

    // 1. Carga instántanea desde caché (evita flash visual)
    const cachedConfig = localStorage.getItem("usarControlDeCaja");
    if (cachedConfig !== null) {
      setUsarControlDeCaja(cachedConfig === "true");
    }

    // 2. Consulta al servidor como fuente de verdad
    const fetchConfig = async () => {
      try {
        const res = await apiService.getConfiguracionGeneral();
        const value = res?.usarControlDeCaja ?? res?.data?.usarControlDeCaja ?? true;
        setUsarControlDeCaja(value);
        localStorage.setItem("usarControlDeCaja", String(value));
      } catch (e) {
        console.error("Error Sidebar:", e);
      }
    };
    fetchConfig();

    // 3. Listener para cambios en vivo desde PosSettingsPage
    const handleConfigChange = (e: any) => {
      const newValue = e.detail.usarControlDeCaja;
      setUsarControlDeCaja(newValue);
    };

    window.addEventListener("config-updated", handleConfigChange);
    return () => window.removeEventListener("config-updated", handleConfigChange);
  }, [activeSucursalId, setAvailableSucursales, setPedidosVencidosCount]);

  const isDark = mounted && resolvedTheme === "dark";
  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  // ✅ FILTRADO DINÁMICO REFINADO
  const filteredBusiness = React.useMemo(() => {
    return NAV_BUSINESS.filter(item => {
      if (item.href === "/consignaciones" && !allowConsignaciones) return false;
      return true;
    });
  }, [allowConsignaciones]);

  const filteredOperations = React.useMemo(() => {
    const ops = [{ label: "Venta Casual", href: "/ventas/nueva", icon: ShoppingCart }];
    if (usarControlDeCaja) {
      ops.push({ label: "Historial", href: "/caja/historial", icon: History });
    }
    return ops;
  }, [usarControlDeCaja]);

  const filteredMobileMenu = React.useMemo(() => {
    const items = [...filteredBusiness];
    if (usarControlDeCaja) {
      items.push({ label: "Historial de Caja", href: "/caja/historial", icon: History });
    }
    items.push({ label: "Configuración", href: "/settings", icon: Settings });
    return items;
  }, [usarControlDeCaja, filteredBusiness]);

  // --- RENDER: Ítem simple (dock) ---
  const renderItem = (item: any, isMobile: boolean) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    const isPedidos = item.href === "/pedidos-esperados";
    const showBadge = isPedidos && pedidosVencidosCount > 0;

    return (
      <DockIcon key={item.href}>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "relative flex items-center justify-center rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isMobile ? "h-9 w-9" : "h-10 w-10",
                  active ? "bg-primary text-primary-foreground shadow-lg scale-110" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className={isMobile ? "h-4 w-4" : "size-5"} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-[3px] rounded-full bg-destructive text-[9px] font-black text-destructive-foreground flex items-center justify-center leading-none animate-pulse">
                    {pedidosVencidosCount > 9 ? "9+" : pedidosVencidosCount}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent side={isMobile ? "top" : "right"}>
              {item.label}
              {showBadge && ` (${pedidosVencidosCount} vencido${pedidosVencidosCount > 1 ? "s" : ""})`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </DockIcon>
    );
  };

  // --- RENDER: Subítem dentro del popover ---
  const renderSubItem = (item: any) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    const isPedidos = item.href === "/pedidos-esperados";
    const showBadge = isPedidos && pedidosVencidosCount > 0;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          active
            ? "bg-primary text-primary-foreground font-semibold shadow-sm"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
      >
        <div className="relative shrink-0">
          <Icon className="h-4 w-4" />
          {showBadge && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-[2px] rounded-full bg-destructive text-[8px] font-black text-destructive-foreground flex items-center justify-center leading-none animate-pulse">
              {pedidosVencidosCount > 9 ? "9+" : pedidosVencidosCount}
            </span>
          )}
        </div>
        <span className="text-sm whitespace-nowrap">{item.label}</span>
        {showBadge && (
          <span className="ml-auto text-[10px] font-bold text-destructive">
            {pedidosVencidosCount}
          </span>
        )}
      </Link>
    );
  };

  const NotificationItem = ({
    isMobile = false,
    notificationsState
  }: {
    isMobile?: boolean;
    notificationsState: ReturnType<typeof useNotifications>
  }) => {
    const { hasUnread } = notificationsState;
    return (
        <Sheet>
        <SheetTrigger asChild>
          <button aria-label="Notificaciones" className="relative flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            <Bell className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
            {hasUnread && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive animate-pulse" />}
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Notificaciones</SheetTitle>
          <NotificationsAnimatedPanel notificationsState={notificationsState} />
        </SheetContent>
      </Sheet>
    );
  };

  if (!mounted) return null;

  return (
    <aside className="fixed bottom-0 left-0 z-50 w-full border-t border-border/60 bg-background/70 backdrop-blur-2xl md:top-0 md:h-screen md:w-[84px] md:border-r md:border-t-0">

      {/* ── MOBILE ── */}
      <div className="md:hidden flex justify-center py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        <div className="relative overflow-hidden rounded-2xl p-[1px]">
          <Dock orientation="horizontal" className="border bg-card/50 backdrop-blur-xl gap-2 px-3">
            {/* EMPLEADO: solo Vender */}
            {isEmpleado
              ? renderItem({ label: "Vender", href: "/ventas/nueva", icon: ShoppingCart }, true)
              : MOBILE_PRIMARY.map(item => renderItem(item, true))
            }
            {/* Menú expandido: solo para ADMIN */}
            {!isEmpleado && (
              <>
                <Separator orientation="vertical" className="h-5 mx-1 opacity-50" />
                <DockIcon>
                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                      <button className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><LayoutGrid className="h-4 w-4" /></button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-[2.5rem] p-6 pb-12 border-t">
                      <SheetHeader className="mb-6"><SheetTitle className="text-left text-2xl font-black">Menú Principal</SheetTitle></SheetHeader>
                      <div className="grid grid-cols-3 gap-4">
                        {filteredMobileMenu.map((item) => (
                          <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-muted/40 active:scale-95 transition-all">
                            <div className="h-12 w-12 rounded-2xl bg-background flex items-center justify-center shadow-sm"><item.icon className="h-6 w-6 text-primary" /></div>
                            <span className="text-[10px] font-bold text-center uppercase tracking-tighter">{item.label}</span>
                          </Link>
                        ))}
                      </div>
                      <Separator className="my-4 opacity-50" />
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-3 p-4 rounded-2xl text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                          <LogOut className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-bold">{loggingOut ? "Cerrando..." : "Cerrar Sesión"}</span>
                      </button>
                    </SheetContent>
                  </Sheet>
                </DockIcon>
              </>
            )}
            <Separator orientation="vertical" className="h-5 mx-1 opacity-50" />
            <DockIcon><NotificationItem isMobile notificationsState={notificationsState} /></DockIcon>
            <DockIcon>
              <button onClick={() => setTheme(isDark ? "light" : "dark")} className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground">
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
                      <TooltipContent side="top">{loggingOut ? "Cerrando..." : "Cerrar Sesión"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </DockIcon>
              </>
            )}
          </Dock>
          <BorderBeam size={50} duration={10} colorFrom="var(--primary)" colorTo="#3b82f6" />
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden h-full w-full md:flex md:flex-col md:items-center md:py-6">

        {/* LOGO POS PRINCIPAL */}
        <Link href="/dashboard" className="transition-transform active:scale-95 mb-8">
          <BrandLogo size="md" />
        </Link>

        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <div className="relative overflow-hidden rounded-3xl p-[1px]">
            <Dock orientation="vertical" className="border border-border/70 bg-card/70 backdrop-blur-xl shadow-xl md:flex-col gap-1.5 p-2">

              {isEmpleado ? (
                /* ── EMPLEADO: Solo Venta Casual ── */
                <>{renderItem({ label: "Venta Casual", href: "/ventas/nueva", icon: ShoppingCart }, false)}</>
              ) : (
                /* ── ADMIN: Navegación agrupada ── */
                <>
                  {/* Dashboard — siempre individual */}
                  {NAV_CORE.map(item => renderItem(item, false))}

                  <Separator className="w-8 mx-auto opacity-50" />

                  {/* GRUPO: Negocio */}
                  <NavGroup
                    label="Negocio"
                    icon={Briefcase}
                    items={filteredBusiness}
                    isActive={isActive}
                    renderSubItem={renderSubItem}
                    badge={pedidosVencidosCount}
                  />

                  {/* GRUPO: Operaciones (animado) */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key="ops-group"
                      initial={{ opacity: 0, scale: 0, height: 0 }}
                      animate={{ opacity: 1, scale: 1, height: "auto" }}
                      exit={{ opacity: 0, scale: 0, height: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <NavGroup
                        label="Operaciones"
                        icon={Zap}
                        items={filteredOperations}
                        isActive={isActive}
                        renderSubItem={renderSubItem}
                      />
                    </motion.div>
                  </AnimatePresence>

                  <Separator className="w-8 mx-auto opacity-50" />

                  {/* Ajustes — siempre individual */}
                  {NAV_ADMIN.map(item => renderItem(item, false))}
                </>
              )}

              <Separator className="w-8 mx-auto opacity-50" />
              <DockIcon><NotificationItem notificationsState={notificationsState} /></DockIcon>
              <DockIcon>
                <button aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"} onClick={() => setTheme(isDark ? "light" : "dark")} className="h-10 w-10 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
                </button>
              </DockIcon>
            </Dock>
            <BorderBeam size={80} duration={15} colorFrom="var(--primary)" colorTo="#3b82f6" />
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
            <TooltipContent side="right">{loggingOut ? "Cerrando..." : "Cerrar Sesión"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="text-[10px] font-bold text-muted-foreground/20 mb-4">v1.2</div>
      </div>
    </aside>
  );
}
