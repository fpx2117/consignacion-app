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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  Store,
  LogOut,
  Wallet,
  ClipboardList,
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
        const res = await fetch("/api/pedidos-esperados?estado=VENCIDO");
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
        // Priorities: Direct property > Nested data property > Default true
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
  }, []);

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
    // Solo agregamos Historial si está estrictamente activo
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
                className={cn(
                  "relative flex items-center justify-center rounded-full transition-all duration-300",
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
          <button className="relative flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-all">
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
    <aside className="fixed bottom-0 left-0 z-50 w-full border-t bg-background/60 backdrop-blur-2xl md:top-0 md:h-screen md:w-[84px] md:border-r md:border-t-0">

      {/* MOBILE */}
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

      {/* DESKTOP */}
      <div className="hidden h-full w-full md:flex md:flex-col md:items-center md:py-6">

        {/* LOGO POS PRINCIPAL */}
        <Link href="/dashboard" className="transition-transform active:scale-95 mb-8">
          <BrandLogo size="md" />
        </Link>

        <div className="flex-1 flex flex-col items-center justify-center w-full">
          <div className="relative overflow-hidden rounded-3xl p-[1px]">
            <Dock orientation="vertical" className="border bg-card/50 backdrop-blur-xl md:flex-col gap-1 p-1.5">

              {isEmpleado ? (
                /* ── EMPLEADO: Solo Venta Casual ── */
                <>{renderItem({ label: "Venta Casual", href: "/ventas/nueva", icon: ShoppingCart }, false)}</>
              ) : (
                /* ── ADMIN: Navegación completa ── */
                <>
                  {NAV_CORE.map(item => renderItem(item, false))}
                  <Separator className="w-8 mx-auto opacity-50" />
                  {filteredBusiness.map(item => renderItem(item, false))}
                  <Separator className="w-8 mx-auto opacity-50" />

                  {/* ANIMACIÓN DE OPERACIONES */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filteredOperations.map(item => (
                      <motion.div
                        key={item.href}
                        initial={{ opacity: 0, scale: 0, height: 0 }}
                        animate={{ opacity: 1, scale: 1, height: "auto" }}
                        exit={{ opacity: 0, scale: 0, height: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      >
                        {renderItem(item, false)}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  <Separator className="w-8 mx-auto opacity-50" />
                  {NAV_ADMIN.map(item => renderItem(item, false))}
                </>
              )}

              <Separator className="w-8 mx-auto opacity-50" />
              <DockIcon><NotificationItem notificationsState={notificationsState} /></DockIcon>
              <DockIcon>
                <button onClick={() => setTheme(isDark ? "light" : "dark")} className="h-10 w-10 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors">
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
                className="mt-auto mb-2 h-10 w-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
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