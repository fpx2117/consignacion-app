"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Store,
  MonitorSmartphone,
  Clock,
  ChevronRight,
  Settings2,
  TerminalSquare,
  Info,
  HelpCircle,
  Percent,
  CreditCard,
  BookMarked,
  Monitor,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";
import { useSucursalStore } from "@/store/useSucursalStore";
import type { Caja, Configuracion } from "@/lib/types";
import { slugify, validateSlug } from "@/lib/storefront/slug";

// ─── Tutorial compartido ───────────────────────────────────────────────────────
import { TutorialButton } from "@/components/ui/tutorial-button";
import { POS_TUTORIAL } from "@/lib/tutorial-content";

type PosToggleKey =
  | "usarControlDeCaja"
  | "mostrarListaPrecios"
  | "convertirTienda"
  | "mostrarEnTiendaOnline";

type PosConfig = Pick<
  Configuracion,
  | "usarControlDeCaja"
  | "porcentajeAumentoConsignacion"
  | "porcentajeInteresTarjeta"
  | "mostrarListaPrecios"
  | "convertirTienda"
  | "tiendaMetodoPago"
  | "mostrarEnTiendaOnline"
  | "tiendaSlug"
  | "mpAccessTokenTienda"
  | "mpPublicKeyTienda"
>;

const SLUG_ERROR_MESSAGES: Record<string, string> = {
  empty: "El nombre de la tienda no puede estar vacío",
  "invalid-format": "Solo letras minúsculas, números y guiones",
  reserved: "Ese nombre no está disponible, elegí otro",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// ─── Inline Help Tip ─────────────────────────────────────────────────────────
function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "h-5 w-5 rounded-full flex items-center justify-center transition-colors shrink-0",
          open
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary",
        )}
        aria-label="Ayuda"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-20 w-64 rounded-xl border border-border/50 bg-popover shadow-xl p-3 text-xs text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span>{text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-all duration-300 shrink-0",
        active
          ? "bg-[color:var(--status-success-strong)]/15 text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)] border border-[color:var(--status-success-strong)]/20"
          : "bg-muted text-muted-foreground border border-border/40",
      )}
    >
      {active ? "✓ Activo" : "Inactivo"}
    </span>
  );
}

// ─── Percentage Preview ───────────────────────────────────────────────────────
function PercentagePreview({
  value,
  baseAmount = 1000,
  label,
}: {
  value: number;
  baseAmount?: number;
  label: string;
}) {
  const result = baseAmount + (baseAmount * value) / 100;
  const diff = result - baseAmount;
  if (value <= 0) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
      <Info className="h-3.5 w-3.5 shrink-0 text-primary/60" />
      <span>
        {label}: ${baseAmount.toLocaleString("es-AR")}
        {" → "}
        <span className="font-bold text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)]">
          ${result.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
        </span>{" "}
        <span className="text-muted-foreground/70">
          (+${diff.toLocaleString("es-AR", { maximumFractionDigits: 0 })})
        </span>
      </span>
    </div>
  );
}

// ─── Section Badge ────────────────────────────────────────────────────────────
function SectionBadge({ number }: { number: string }) {
  return (
    <span className="hidden sm:flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-[11px] font-black text-muted-foreground/60 border border-border/30 shrink-0">
      {number}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PosSettingsPage() {
  const router = useRouter();
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);

  const [cajas, setCajas] = React.useState<Caja[]>([]);
  const [nombreNuevaCaja, setNombreNuevaCaja] = React.useState("");
  const [usarControlDeCaja, setUsarControlDeCaja] = React.useState(true);
  const [porcentajeAumentoConsignacion, setPorcentajeAumentoConsignacion] =
    React.useState(0);
  const [porcentajeInteresTarjeta, setPorcentajeInteresTarjeta] =
    React.useState(0);
  const [mostrarListaPrecios, setMostrarListaPrecios] = React.useState(false);
  const [convertirTienda, setConvertirTienda] = React.useState(false);
  const [tiendaMetodoPago, setTiendaMetodoPago] = React.useState<
    "whatsapp" | "mercadopago"
  >("whatsapp");
  const [mostrarEnTiendaOnline, setMostrarEnTiendaOnline] =
    React.useState(false);
  const [tiendaSlug, setTiendaSlug] = React.useState<string>("");
  const [tiendaSlugInput, setTiendaSlugInput] = React.useState<string>("");
  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [modoUnificado, setModoUnificado] = React.useState(true);
  const [mpAccessTokenTienda, setMpAccessTokenTienda] = React.useState("");
  const [mpPublicKeyTienda, setMpPublicKeyTienda] = React.useState("");
  const [whatsappNumber, setWhatsappNumber] = React.useState("");

  const [loading, setLoading] = React.useState(true);
  const [loadingConfigToggle, setLoadingConfigToggle] = React.useState(false);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const [loadingMetodoPago, setLoadingMetodoPago] = React.useState(false);
  const [loadingModoTienda, setLoadingModoTienda] = React.useState(false);
  const [loadingSlug, setLoadingSlug] = React.useState(false);

  const fetchInitialData = React.useCallback(async () => {
    try {
      const cachedConfig = localStorage.getItem(
        `config-caja-${activeSucursalId}`,
      );
      if (cachedConfig !== null) setUsarControlDeCaja(cachedConfig === "true");

      const [cajasRes, configRes, brandingRes, tiendaGlobalRes] =
        await Promise.all([
          apiService.getCajasDisponibles(),
          apiService.getConfiguracionGeneral(),
          apiService.getBranding().catch(() => null),
          apiService.getTiendaGlobalConfig().catch(() => null),
        ]);

      setCajas(Array.isArray(cajasRes) ? cajasRes : []);
      const config = configRes as Partial<PosConfig> | undefined;
      setWhatsappNumber(
        (brandingRes as { whatsappNumber?: string | null } | null)
          ?.whatsappNumber ?? "",
      );

      setUsarControlDeCaja(config?.usarControlDeCaja ?? true);
      localStorage.setItem(
        `config-caja-${activeSucursalId}`,
        String(config?.usarControlDeCaja ?? true),
      );
      setPorcentajeAumentoConsignacion(
        config?.porcentajeAumentoConsignacion ?? 0,
      );
      setPorcentajeInteresTarjeta(config?.porcentajeInteresTarjeta ?? 0);
      setMostrarListaPrecios(config?.mostrarListaPrecios ?? false);
      setConvertirTienda(config?.convertirTienda ?? false);
      setTiendaMetodoPago(config?.tiendaMetodoPago ?? "whatsapp");
      setMostrarEnTiendaOnline(config?.mostrarEnTiendaOnline ?? false);
      setTiendaSlug(config?.tiendaSlug ?? "");
      setTiendaSlugInput(config?.tiendaSlug ?? "");
      setModoUnificado(tiendaGlobalRes?.modoUnificado ?? true);
      setMpAccessTokenTienda(config?.mpAccessTokenTienda ?? "");
      setMpPublicKeyTienda(config?.mpPublicKeyTienda ?? "");
    } catch (error) {
      toast.error(getErrorMessage(error, "Error al cargar los datos."));
    } finally {
      setLoading(false);
    }
  }, [activeSucursalId]);

  React.useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleCrearCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNuevaCaja.trim()) return;
    setLoadingSubmit(true);
    try {
      await apiService.crearCajaFisica(nombreNuevaCaja);
      toast.success("Terminal creada correctamente.");
      setNombreNuevaCaja("");
      const res = await apiService.getCajasDisponibles();
      setCajas(Array.isArray(res) ? res : []);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo crear la terminal."));
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleToggleConfig = async (key: PosToggleKey, checked: boolean) => {
    setLoadingConfigToggle(true);
    try {
      await apiService.actualizarConfiguracionGeneral({ [key]: checked });
      if (key === "usarControlDeCaja") {
        setUsarControlDeCaja(checked);
        localStorage.setItem(
          `config-caja-${activeSucursalId}`,
          String(checked),
        );
        window.dispatchEvent(
          new CustomEvent("config-updated", {
            detail: { usarControlDeCaja: checked },
          }),
        );
      } else if (key === "mostrarListaPrecios") setMostrarListaPrecios(checked);
      else if (key === "convertirTienda") setConvertirTienda(checked);
      else if (key === "mostrarEnTiendaOnline")
        setMostrarEnTiendaOnline(checked);
      toast.success("Configuración actualizada");
    } catch {
      toast.error("Error al actualizar la configuración.");
    } finally {
      setLoadingConfigToggle(false);
    }
  };

  const handleCambiarModoTienda = async (nuevoModo: boolean) => {
    if (nuevoModo === modoUnificado) return;
    setLoadingModoTienda(true);
    try {
      await apiService.actualizarTiendaGlobalConfig({
        modoUnificado: nuevoModo,
      });
      setModoUnificado(nuevoModo);
      toast.success("Modo de tienda actualizado");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Error al actualizar el modo de tienda."),
      );
    } finally {
      setLoadingModoTienda(false);
    }
  };

  const handleGuardarSlug = async () => {
    const result = validateSlug(tiendaSlugInput);
    if (!result.ok) {
      setSlugError(SLUG_ERROR_MESSAGES[result.error]);
      return;
    }
    setSlugError(null);
    setLoadingSlug(true);
    try {
      await apiService.actualizarConfiguracionGeneral({
        tiendaSlug: result.slug,
      });
      setTiendaSlug(result.slug);
      setTiendaSlugInput(result.slug);
      toast.success("Nombre de la tienda guardado");
    } catch (error) {
      toast.error(
        getErrorMessage(error, "No se pudo guardar el nombre de la tienda."),
      );
    } finally {
      setLoadingSlug(false);
    }
  };

  const handleSelectMetodoPago = async (metodo: "whatsapp" | "mercadopago") => {
    if (metodo === tiendaMetodoPago) return;
    setLoadingMetodoPago(true);
    try {
      await apiService.actualizarConfiguracionGeneral({
        tiendaMetodoPago: metodo,
      });
      setTiendaMetodoPago(metodo);
      toast.success("Método de pago actualizado");
    } catch {
      toast.error("Error al actualizar el método de pago.");
    } finally {
      setLoadingMetodoPago(false);
    }
  };

  const handleActualizarDatos = async () => {
    setLoadingSubmit(true);
    try {
      await apiService.actualizarConfiguracionGeneral({
        porcentajeAumentoConsignacion: Number(porcentajeAumentoConsignacion),
        porcentajeInteresTarjeta: Number(porcentajeInteresTarjeta),
        mpAccessTokenTienda,
        mpPublicKeyTienda,
      });
      toast.success("Configuración actualizada correctamente.");
    } catch {
      toast.error("Error al actualizar la configuración.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-8 text-foreground selection:bg-primary/20">
      {/* HEADER */}
      <header className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 rounded-full h-11 w-11 border-border/40 shadow-sm hover:bg-muted/50 transition-colors"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5 sm:h-6 sm:w-6 text-primary/80 shrink-0" />
            <span className="truncate">Punto de Venta</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">
            Gestiona las preferencias de cobro, restricciones y terminales
            físicas.
          </p>
        </div>
        {/* Botón tutorial compartido — ícono solo en mobile, texto en desktop */}
        <TutorialButton steps={POS_TUTORIAL} />
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Cargando preferencias...
          </p>
        </div>
      ) : (
        <div className="grid gap-8">
          {/* ── BLOQUE 1: REGLAS DE OPERACIÓN ─────────────────── */}
          <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
            <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
              <SectionBadge number="01" />
              <div className="p-2 bg-[color:var(--theme-ocean-primary)]/5 rounded-xl border border-[color:var(--theme-ocean-primary)]/15">
                <Settings2 className="w-5 h-5 text-[color:var(--theme-ocean-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base sm:text-lg tracking-tight">
                  Reglas de Operación
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Comportamiento de caja, turnos y recargos de precio.
                </p>
              </div>
            </div>

            <div className="divide-y divide-border/40">
              {/* Modo Estricto */}
              <div className="p-4 sm:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm sm:text-base text-foreground">
                      Modo Estricto de Caja
                    </h3>
                    <StatusBadge active={usarControlDeCaja} />
                    <HelpTip text="Cuando está activo, los empleados DEBEN abrir un turno de caja antes de poder registrar cualquier venta. Ideal para control de efectivo." />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Exige la apertura de un turno de caja para procesar ventas.
                  </p>
                </div>
                <div className="shrink-0 flex items-center">
                  {loadingConfigToggle ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Switch
                      checked={usarControlDeCaja}
                      onCheckedChange={(checked) =>
                        handleToggleConfig("usarControlDeCaja", checked)
                      }
                      className="data-[state=checked]:bg-primary"
                    />
                  )}
                </div>
              </div>

              {/* Control de Horarios */}
              <div
                onClick={() => {
                  if (usarControlDeCaja) router.push("/settings/pos/horarios");
                }}
                className={cn(
                  "p-4 sm:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors",
                  usarControlDeCaja
                    ? "hover:bg-muted/30 cursor-pointer group"
                    : "opacity-50 cursor-not-allowed bg-muted/10 grayscale",
                )}
              >
                <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                  <div
                    className={cn(
                      "mt-1 sm:mt-0 p-2.5 rounded-xl transition-colors shrink-0",
                      usarControlDeCaja
                        ? "bg-muted group-hover:bg-[color:var(--status-warning)]/10 group-hover:text-[color:var(--status-warning)]"
                        : "bg-muted/50 text-muted-foreground",
                    )}
                  >
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={cn(
                          "font-medium text-sm sm:text-base transition-colors",
                          usarControlDeCaja
                            ? "text-foreground group-hover:text-[color:var(--status-warning)] dark:group-hover:text-[color:var(--status-warning)]"
                            : "text-muted-foreground",
                        )}
                      >
                        Control de Horarios
                      </h3>
                      {!usarControlDeCaja && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-background border border-border/50 text-muted-foreground px-2 py-0.5 rounded-full">
                          <Lock className="h-3 w-3" /> Requiere Modo Estricto
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Restringe los accesos al POS según el turno laboral de
                      cada empleado.
                    </p>
                  </div>
                </div>
                {usarControlDeCaja && (
                  <div className="h-8 w-8 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform shrink-0 self-center">
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-[color:var(--status-warning)]" />
                  </div>
                )}
              </div>

              {/* Porcentaje Consignación */}
              <div className="p-4 sm:p-6 md:px-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm sm:text-base text-foreground">
                      Ajuste de Precio para Consignaciones
                    </h3>
                    <HelpTip text="Este porcentaje se suma automáticamente al precio del proveedor cuando creás una nueva consignación. Representa tu margen de ganancia." />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Porcentaje que se sumará al precio base al crear una
                    consignación.
                  </p>
                  <PercentagePreview
                    value={porcentajeAumentoConsignacion}
                    label="Consignación"
                  />
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <div className="relative w-[100px] sm:w-[110px]">
                    <Input
                      type="number"
                      value={porcentajeAumentoConsignacion}
                      onChange={(e) =>
                        setPorcentajeAumentoConsignacion(Number(e.target.value))
                      }
                      className="h-11 pr-8 text-center font-bold text-primary bg-background border-border/50 rounded-xl"
                      min={0}
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Porcentaje Tarjeta */}
              <div className="p-4 sm:p-6 md:px-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm sm:text-base text-foreground">
                      Interés por Pago con Tarjeta
                    </h3>
                    <HelpTip text="Al cobrar con tarjeta, este porcentaje se suma automáticamente al total de la venta para cubrir comisiones bancarias." />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Porcentaje adicional cuando el cliente elige pagar con
                    tarjeta.
                  </p>
                  <PercentagePreview
                    value={porcentajeInteresTarjeta}
                    label="Con tarjeta"
                  />
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <div className="relative w-[100px] sm:w-[110px]">
                    <Input
                      type="number"
                      value={porcentajeInteresTarjeta}
                      onChange={(e) =>
                        setPorcentajeInteresTarjeta(Number(e.target.value))
                      }
                      className="h-11 pr-8 text-center font-bold text-primary bg-background border-border/50 rounded-xl"
                      min={0}
                    />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Guardar */}
              <div className="p-4 sm:p-6 md:px-8 flex justify-end bg-muted/5 border-t border-border/30">
                <Button
                  onClick={handleActualizarDatos}
                  disabled={loadingSubmit}
                  className="rounded-xl px-5 sm:px-6 gap-2 h-10 sm:h-11"
                >
                  {loadingSubmit ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    "Guardar Configuración"
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* ── BLOQUE 2: TIENDA ONLINE ────────────────────────── */}
          <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
            <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
              <SectionBadge number="02" />
              <div className="p-2 bg-[color:var(--primary)]/5 rounded-xl border border-[color:var(--primary)]/15">
                <Store className="w-5 h-5 text-[color:var(--primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base sm:text-lg tracking-tight">
                  Tienda Online / Catálogo
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Configura tu catálogo público y pasarela de pagos.
                </p>
              </div>
            </div>

            <div className="divide-y divide-border/40">
              {/* Catálogo Público */}
              <div className="p-4 sm:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm sm:text-base text-foreground">
                      Habilitar Catálogo Público
                    </h3>
                    <StatusBadge active={mostrarListaPrecios} />
                    <HelpTip text="Crea un link público donde tus clientes ven productos y precios. Solo pueden VER, no comprar." />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                    Permite que cualquier persona vea tus productos a través de
                    un link público.
                  </p>
                </div>
                <Switch
                  checked={mostrarListaPrecios}
                  onCheckedChange={(checked) =>
                    handleToggleConfig("mostrarListaPrecios", checked)
                  }
                />
              </div>

              {/* Modo Tienda */}
              <div className="p-4 sm:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm sm:text-base text-foreground">
                      Habilitar Carrito de Compras
                    </h3>
                    <StatusBadge active={convertirTienda} />
                    <HelpTip text="Agrega un carrito de compras al catálogo. Elegís abajo si el pedido se cobra con Mercado Pago o se envía por WhatsApp. Es una opción u otra, nunca las dos al mismo tiempo." />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                    Agrega carrito al catálogo público. El método de cobro se
                    elige abajo.
                  </p>
                </div>
                <Switch
                  checked={convertirTienda}
                  onCheckedChange={(checked) =>
                    handleToggleConfig("convertirTienda", checked)
                  }
                />
              </div>

              {/* Método de pago del carrito */}
              {convertirTienda && (
                <div className="p-4 sm:p-6 md:px-8 bg-muted/5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[color:var(--primary)]" />
                    <span className="text-sm font-semibold text-foreground">
                      Método de pago del carrito
                    </span>
                    <HelpTip text="Elegí si el pedido se cobra online con Mercado Pago o se envía como mensaje de WhatsApp al número configurado en Personalización → Social. Cambiar de método no borra las credenciales de Mercado Pago que ya cargaste." />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={loadingMetodoPago}
                      onClick={() => handleSelectMetodoPago("whatsapp")}
                      className={cn(
                        "text-left p-4 rounded-2xl border-2 transition-all disabled:opacity-60",
                        tiendaMetodoPago === "whatsapp"
                          ? "border-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/5"
                          : "border-border/40 hover:border-border",
                      )}
                    >
                      <p className="font-semibold text-sm text-foreground">
                        WhatsApp
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        El pedido se envía como mensaje al número configurado en
                        Personalización.
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={loadingMetodoPago}
                      onClick={() => handleSelectMetodoPago("mercadopago")}
                      className={cn(
                        "text-left p-4 rounded-2xl border-2 transition-all disabled:opacity-60",
                        tiendaMetodoPago === "mercadopago"
                          ? "border-[color:var(--primary)] bg-[color:var(--primary)]/5"
                          : "border-border/40 hover:border-border",
                      )}
                    >
                      <p className="font-semibold text-sm text-foreground">
                        Mercado Pago
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pago online. Requiere las credenciales cargadas abajo.
                      </p>
                    </button>
                  </div>
                  {tiendaMetodoPago === "mercadopago" &&
                    (!mpAccessTokenTienda || !mpPublicKeyTienda) && (
                      <p className="text-xs text-[color:var(--status-warning)] font-medium">
                        Elegiste Mercado Pago pero todavía faltan credenciales.
                        Cargalas abajo para que el carrito funcione.
                      </p>
                    )}
                  {tiendaMetodoPago === "whatsapp" &&
                    !whatsappNumber.trim() && (
                      <p className="text-xs text-[color:var(--status-warning)] font-medium">
                        Elegiste WhatsApp pero todavía no cargaste un número. El
                        carrito no aparecerá en el catálogo hasta que lo
                        configures en{" "}
                        <button
                          type="button"
                          onClick={() =>
                            router.push("/settings/tienda?tab=social")
                          }
                          className="underline underline-offset-2 hover:opacity-80"
                        >
                          Personalización → Redes
                        </button>
                        .
                      </p>
                    )}
                </div>
              )}

              {/* Modo de Tienda (decisión global, afecta a todas las sucursales) */}
              <div className="p-4 sm:p-6 md:px-8 bg-muted/5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-sm sm:text-base text-foreground">
                    Modo de Tienda
                  </h3>
                  <HelpTip text="Esta decisión aplica a TODO el negocio, no solo a esta sucursal. 'Tienda unificada' combina en un solo link los productos de las sucursales que activaron 'Mostrar en Tienda Online'. 'Por sucursal' le da a cada una su propio link con el nombre que elija." />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground -mt-1">
                  Elegí si todas las sucursales comparten un solo catálogo, o si
                  cada una tiene su propio link.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={loadingModoTienda}
                    onClick={() => handleCambiarModoTienda(true)}
                    className={cn(
                      "text-left p-4 rounded-2xl border-2 transition-all disabled:opacity-60",
                      modoUnificado
                        ? "border-[color:var(--primary)] bg-[color:var(--primary)]/5"
                        : "border-border/40 hover:border-border",
                    )}
                  >
                    <p className="font-semibold text-sm text-foreground">
                      Tienda unificada
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Un solo link (/lista) combina las sucursales que optaron
                      in.
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={loadingModoTienda}
                    onClick={() => handleCambiarModoTienda(false)}
                    className={cn(
                      "text-left p-4 rounded-2xl border-2 transition-all disabled:opacity-60",
                      !modoUnificado
                        ? "border-[color:var(--primary)] bg-[color:var(--primary)]/5"
                        : "border-border/40 hover:border-border",
                    )}
                  >
                    <p className="font-semibold text-sm text-foreground">
                      Cada sucursal, su tienda
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cada sucursal tiene su propio link con el nombre que
                      elija.
                    </p>
                  </button>
                </div>
              </div>

              {/* Mostrar esta sucursal en la tienda online (opt-in) */}
              <div className="p-4 sm:p-6 md:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm sm:text-base text-foreground">
                      Mostrar esta Sucursal en la Tienda Online
                    </h3>
                    <StatusBadge active={mostrarEnTiendaOnline} />
                    <HelpTip text="Si está apagado, los productos de esta sucursal NO aparecen en la tienda online (ni en la unificada ni en su propio link). Los productos nuevos no se agregan automáticamente hasta que actives esto." />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                    Controla si los productos de esta sucursal participan de la
                    tienda online.
                  </p>
                </div>
                <Switch
                  checked={mostrarEnTiendaOnline}
                  onCheckedChange={(checked) =>
                    handleToggleConfig("mostrarEnTiendaOnline", checked)
                  }
                />
              </div>

              {/* Nombre de la tienda / slug (solo relevante en modo "por sucursal") */}
              <div
                className={cn(
                  "p-4 sm:p-6 md:px-8 space-y-2 transition-colors",
                  !modoUnificado
                    ? "hover:bg-muted/20"
                    : "bg-muted/5 opacity-70",
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-sm sm:text-base text-foreground">
                    Nombre de tu Tienda (URL)
                  </h3>
                  <HelpTip text="Se usa cuando el Modo de Tienda está en 'Cada sucursal, su tienda'. Define la URL pública de esta sucursal: tudominio.com/{nombre}." />
                  {modoUnificado && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-background border border-border/50 text-muted-foreground px-2 py-0.5 rounded-full">
                      Solo aplica en modo &quot;Por sucursal&quot;
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="flex-1 min-w-0">
                    <Input
                      value={tiendaSlugInput}
                      onChange={(e) => {
                        setTiendaSlugInput(e.target.value);
                        setSlugError(null);
                      }}
                      placeholder="mi-sucursal-norte"
                      className="h-11 rounded-xl bg-background border-border/50"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1.5 ml-1 truncate">
                      {typeof window !== "undefined"
                        ? window.location.origin
                        : ""}
                      /{slugify(tiendaSlugInput) || "..."}
                    </p>
                    {slugError && (
                      <p className="text-[11px] text-[color:var(--status-warning)] mt-1 ml-1 font-medium">
                        {slugError}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleGuardarSlug}
                    disabled={loadingSlug || tiendaSlugInput === tiendaSlug}
                    variant="outline"
                    className="h-11 rounded-xl shrink-0"
                  >
                    {loadingSlug ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Guardar"
                    )}
                  </Button>
                </div>
              </div>

              {/* Credenciales MP */}
              {convertirTienda && (
                <div className="p-4 sm:p-6 md:px-8 bg-muted/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <BookMarked className="h-4 w-4 text-[color:var(--primary)]" />
                    <span className="text-sm font-semibold text-foreground">
                      Credenciales de Mercado Pago
                    </span>
                    <HelpTip text="Obtenelas en developers.mercadopago.com → Tu aplicación → Credenciales de producción." />
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Quedan guardadas aunque elijas WhatsApp como método activo
                    arriba, así no las perdés si después querés volver a Mercado
                    Pago.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                        MP Public Key
                      </label>
                      <Input
                        placeholder="APP_USR-xxxxxxxx..."
                        value={mpPublicKeyTienda}
                        onChange={(e) => setMpPublicKeyTienda(e.target.value)}
                        className="bg-background rounded-xl"
                      />
                      <p className="text-[11px] text-muted-foreground ml-1">
                        Clave pública · Visible en el frontend
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                        MP Access Token
                      </label>
                      <Input
                        type="password"
                        placeholder="APP_USR-xxxxxxxx..."
                        value={mpAccessTokenTienda}
                        onChange={(e) => setMpAccessTokenTienda(e.target.value)}
                        className="bg-background rounded-xl"
                      />
                      <p className="text-[11px] text-muted-foreground ml-1">
                        Secreto · Nunca lo compartas
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      onClick={handleActualizarDatos}
                      disabled={loadingSubmit}
                      className="rounded-xl gap-2 h-10"
                    >
                      {loadingSubmit && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Guardar Credenciales
                    </Button>
                  </div>
                </div>
              )}

              {/* Link activo */}
              {mostrarListaPrecios && (
                <div className="p-4 sm:p-5 md:px-8 flex items-center justify-between bg-primary/5 border-t border-primary/10 gap-3 flex-wrap">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="h-2 w-2 rounded-full bg-[color:var(--status-success-strong)] animate-pulse shrink-0" />
                    <p className="text-xs sm:text-sm font-medium text-primary/80 truncate">
                      Activo en:{" "}
                      <code className="bg-primary/10 px-1.5 py-0.5 rounded text-primary text-xs">
                        {modoUnificado
                          ? "/lista"
                          : tiendaSlug
                            ? `/${tiendaSlug}`
                            : "(falta definir el nombre de tu tienda)"}
                      </code>
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!modoUnificado && !tiendaSlug}
                    className="text-primary hover:text-primary hover:bg-primary/10 font-bold rounded-xl shrink-0"
                    onClick={() => {
                      const url = modoUnificado
                        ? `${window.location.origin}/lista`
                        : `${window.location.origin}/${tiendaSlug}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Link copiado al portapapeles");
                    }}
                  >
                    Copiar Link
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* ── BLOQUE 3: TERMINALES ──────────────────────────── */}
          <Card className="rounded-[24px] border-border/40 shadow-sm bg-card overflow-hidden">
            <div className="p-6 md:px-8 border-b border-border/40 flex items-center gap-3 bg-muted/5">
              <SectionBadge number="03" />
              <div className="p-2 bg-[color:var(--theme-ocean-primary)]/5 rounded-xl border border-[color:var(--theme-ocean-primary)]/15">
                <TerminalSquare className="w-5 h-5 text-[color:var(--theme-ocean-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base sm:text-lg tracking-tight">
                  Terminales Físicas
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Administración de puntos de cobro y gavetas operativas.
                </p>
              </div>
              <HelpTip text="Cada terminal es un dispositivo de cobro. Si tenés 2 mostradores, creá 2 terminales." />
            </div>

            <div className="p-4 sm:p-6 md:p-8 space-y-5 bg-muted/5">
              <div className="flex items-start gap-2.5 rounded-xl bg-[color:var(--theme-ocean-primary)]/5 border border-[color:var(--theme-ocean-primary)]/15 px-4 py-3">
                <Info className="h-4 w-4 text-[color:var(--theme-ocean-primary)] shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-[color:var(--theme-ocean-primary)] dark:text-[color:var(--theme-ocean-primary)] leading-relaxed">
                  Nombre descriptivo para cada terminal. Ej:{" "}
                  <strong>Caja Mostrador 1</strong>,{" "}
                  <strong>Planta Alta</strong>.
                </p>
              </div>

              <form
                onSubmit={handleCrearCaja}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Input
                  placeholder="Nombre de la terminal (Ej: Caja Mostrador 1)"
                  value={nombreNuevaCaja}
                  onChange={(e) => setNombreNuevaCaja(e.target.value)}
                  className="flex-1 h-11 sm:h-12 rounded-xl bg-background border-border/50 focus-visible:ring-primary/20 transition-all shadow-sm"
                  required
                />
                <Button
                  type="submit"
                  disabled={loadingSubmit || !nombreNuevaCaja.trim()}
                  className="h-11 sm:h-12 px-5 sm:px-8 rounded-xl font-medium shadow-sm shrink-0"
                >
                  {loadingSubmit ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Añadir Terminal
                </Button>
              </form>

              <div className="bg-background rounded-2xl border border-border/40 overflow-hidden shadow-sm">
                {cajas.length === 0 ? (
                  <div className="py-12 sm:py-16 flex flex-col items-center justify-center text-muted-foreground/40">
                    <Monitor className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium tracking-wide">
                      NO HAY TERMINALES REGISTRADAS
                    </p>
                    <p className="text-xs mt-1 opacity-70">
                      Añadí tu primera terminal arriba
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {cajas.map((caja, index) => (
                      <li
                        key={caja.id}
                        className="flex items-center justify-between p-3 sm:p-4 sm:px-6 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[color:var(--theme-ocean-primary)]/10 border border-[color:var(--theme-ocean-primary)]/20 flex items-center justify-center shrink-0 text-[color:var(--theme-ocean-primary)] font-black text-sm">
                            {index + 1}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {caja.nombre}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono mt-0.5 opacity-80">
                              REF-{caja.id.toString().padStart(4, "0")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10 dark:bg-[color:var(--status-success-strong)]/20 px-2 sm:px-3 py-1 rounded-full border border-[color:var(--status-success-strong)]/20 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-success-strong)] animate-pulse" />
                          Operativa
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
