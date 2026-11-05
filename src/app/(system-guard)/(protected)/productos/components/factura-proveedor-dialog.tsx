"use client";

import * as React from "react";
import {
  apiService,
  type FacturaProveedor,
  type FacturaProveedorItem,
  type Proveedor,
  type UpdateFacturaProveedorInput,
  type UpdateFacturaProveedorItemInput,
} from "@/lib/apiService";
import type { Producto } from "@/lib/types";
import { useDolarBlue } from "@/hooks/useDolarBlue";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ScanText,
  Loader2,
  CheckCircle2,
  Sparkles,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { CreateProductoInitialValues } from "./create-producto-dialog";
import { FacturaUploadPane } from "./factura-upload-pane";
import { FacturaItemRow, type FacturaItemRowContext } from "./factura-item-row";
import { FacturaResumenLateral } from "./factura-resumen-lateral";
import { FacturaDatosGenerales } from "./factura-datos-generales";
import { FacturaCompanionDialogs } from "./factura-companion-dialogs";
import { useFacturaUpload } from "./use-factura-upload";
import { cn } from "@/lib/utils";

import {
  ESTADOS_TERMINALES,
  bucketsDeItem,
  inferirCodigoBarra,
  normalizarNombreSugerido,
  type FacturaProveedorItemConCatalogoGlobal,
  type FiltroFactura,
} from "./factura-proveedor-helpers";


export function FacturaProveedorDialog({
  trigger,
  onCreated,
  facturaIdInicial,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  trigger?: React.ReactNode;
  onCreated?: () => void;
  /** Si viene, al abrir el diálogo se retoma esa factura (ya analizada, en
   * revisión) cargándola directamente en la pantalla de revisión, en vez de
   * arrancar en la carga de un archivo nuevo. Se usa desde el listado de
   * facturas para no re-escanear (y no volver a gastar tokens). */
  facturaIdInicial?: number | null;
  /** Control externo de apertura (para abrirlo programáticamente al retomar). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      controlledOnOpenChange?.(value);
      if (controlledOpen === undefined) setInternalOpen(value);
    },
    [controlledOnOpenChange, controlledOpen],
  );
  // Carga de la factura a retomar (spinner mientras se trae del backend).
  const [factura, setFactura] = React.useState<FacturaProveedor | null>(null);
  const [items, setItems] = React.useState<FacturaProveedorItem[] | null>(null);
  const [productos, setProductos] = React.useState<Producto[]>([]);
  const [proveedores, setProveedores] = React.useState<Proveedor[]>([]);
  const [busyItemId, setBusyItemId] = React.useState<number | null>(null);
  const { rate: cotizacionDolar } = useDolarBlue();
  const [confirmandoTodos, setConfirmandoTodos] = React.useState(false);
  // El proveedor puede haberse asignado/creado automáticamente al procesar la
  // factura (ver process/route.ts) — antes de confirmar todo se le muestra al
  // usuario para que lo valide o lo corrija, en vez de darlo por sentado.
  const [confirmarProveedorOpen, setConfirmarProveedorOpen] =
    React.useState(false);
  // Filtro activo de la tabla de productos (todos / pendientes / etc.).
  const [filtroActivo, setFiltroActivo] =
    React.useState<FiltroFactura>("todos");
  const [itemParaCrear, setItemParaCrear] =
    React.useState<FacturaProveedorItem | null>(null);
  const [itemIdParaEditar, setItemIdParaEditar] = React.useState<number | null>(
    null,
  );
  const [itemIdParaMatch, setItemIdParaMatch] = React.useState<number | null>(
    null,
  );
  // Precio de venta borrador por item sin coincidencia — no existe en el modelo
  // de FacturaProveedorItem (la factura solo trae costo), así que se sostiene
  // acá hasta que el usuario crea el producto y pasa a ser un campo real.
  const [precioVentaBorrador, setPrecioVentaBorrador] = React.useState<
    Record<number, number | null>
  >({});
  // Trackea si hay un dialog anidado (crear/editar/buscar producto) abierto,
  // para que el dialog padre no se cierre en cascada cuando el anidado
  // detecta un click/Escape "afuera" (ambos son overlays de Radix portados a
  // document.body — sin esto, el padre confunde esa interacción como si
  // fuera afuera de sí mismo).
  const nestedDialogOpen =
    itemParaCrear !== null ||
    itemIdParaEditar !== null ||
    itemIdParaMatch !== null;
  const [imagenPreviewError, setImagenPreviewError] = React.useState(false);

  const {
    cargandoInicial,
    setCargandoInicial,
    subiendo,
    trabajando,
    selectedFile,
    dragActive,
    setDragActive,
    usage,
    setUsage,
    fileInputRef,
    selectorArchivoAbiertoRef,
    sinCupo,
    resetUpload,
    abrirSelectorArchivo,
    handleFileInput,
    handleDrop,
    analizarFactura,
  } = useFacturaUpload({
    onFacturaCargada: (procesada) => {
      setFactura(procesada);
      setItems(procesada.items ?? []);
    },
    onFacturaLimpiada: () => {
      setFactura(null);
      setItems(null);
    },
  });
  React.useEffect(() => {
    if (!open) {
      setFactura(null);
      setItems(null);
      setFiltroActivo("todos");
      setItemParaCrear(null);
      setItemIdParaMatch(null);
      setPrecioVentaBorrador({});
      resetUpload();
      return;
    }
    apiService
      .getProductos()
      .then(setProductos)
      .catch(() => setProductos([]));
    apiService
      .getProveedores()
      .then(setProveedores)
      .catch(() => setProveedores([]));
    // Refresca el contador cada vez que se abre (puede haber cambiado el uso).
    apiService
      .getFacturaProveedorUsage()
      .then(setUsage)
      .catch(() => setUsage(null));

    // Modo "retomar": si se abre con una factura ya analizada, se carga
    // directamente en la pantalla de revisión (sin subir un archivo nuevo).
    if (facturaIdInicial != null) {
      let cancelado = false;
      setCargandoInicial(true);
      apiService
        .getFacturaProveedor(facturaIdInicial)
        .then((f) => {
          if (cancelado) return;
          setFactura(f);
          setItems(f.items ?? []);
        })
        .catch((err: unknown) => {
          if (cancelado) return;
          toast.error(
            err instanceof Error
              ? err.message
              : "No se pudo cargar la factura para retomar",
          );
          setOpen(false);
        })
        .finally(() => {
          if (!cancelado) setCargandoInicial(false);
        });
      return () => {
        cancelado = true;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setOpen es estable; sólo debe re-cargar cuando cambia open o la factura a retomar.
  }, [open, facturaIdInicial]);

  function updateItem(itemId: number, patch: Partial<FacturaProveedorItem>) {
    setItems(
      (prev) =>
        prev?.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) ?? null,
    );
  }

  // Todos los campos detectados por OCR/IA son editables antes de confirmar:
  // guarda optimistamente en el estado local y persiste con un PATCH al perder foco.
  function updateFacturaLocal(patch: Partial<FacturaProveedor>) {
    setFactura((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function guardarCampoFactura(patch: UpdateFacturaProveedorInput) {
    if (!factura) return;
    updateFacturaLocal(patch as Partial<FacturaProveedor>);
    try {
      const actualizada = await apiService.updateFacturaProveedor(
        factura.id,
        patch,
      );
      setFactura(actualizada);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el cambio",
      );
    }
  }

  async function guardarCampoItem(
    item: FacturaProveedorItem,
    patch: UpdateFacturaProveedorItemInput,
  ) {
    updateItem(item.id, patch as Partial<FacturaProveedorItem>);
    try {
      const actualizado = await apiService.updateFacturaProveedorItem(
        item.id,
        patch,
      );
      updateItem(item.id, actualizado);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el cambio",
      );
    }
  }

  // Al cambiar la moneda de la factura entre ARS y USD, los costos unitarios
  // ya cargados quedan expresados en la moneda vieja — hay que re-expresarlos
  // en la nueva usando la cotización del dólar blue, así el costo real no
  // cambia, solo la moneda en la que se muestra/persiste.
  async function cambiarMonedaFactura(nuevaMoneda: string) {
    const monedaAnterior = monedaFactura;
    if (nuevaMoneda === monedaAnterior) return;

    const esConversionSoportada =
      (monedaAnterior === "USD" && nuevaMoneda === "ARS") ||
      (monedaAnterior === "ARS" && nuevaMoneda === "USD");

    if (esConversionSoportada && items && items.length > 0) {
      if (!cotizacionDolar) {
        toast.warning(
          "No se pudo obtener la cotización del dólar — los costos unitarios no se convirtieron.",
        );
      } else {
        const factor =
          monedaAnterior === "USD" ? cotizacionDolar : 1 / cotizacionDolar;
        await Promise.all(
          items.map((item) => {
            if (item.precioUnitario == null) return Promise.resolve();
            const convertido =
              Math.round(item.precioUnitario * factor * 100) / 100;
            return guardarCampoItem(item, { precioUnitario: convertido });
          }),
        );
        toast.message(
          `Costos unitarios convertidos de ${monedaAnterior} a ${nuevaMoneda}`,
        );
      }
    }

    await guardarCampoFactura({ moneda: nuevaMoneda });
  }

  async function confirmarItem(
    item: FacturaProveedorItem,
    productoIdElegido?: number,
  ) {
    const productoId = productoIdElegido ?? item.productoId;
    if (!productoId) {
      toast.error("Elegí un producto antes de confirmar");
      return;
    }
    setBusyItemId(item.id);
    try {
      const resultado = await apiService.confirmFacturaProveedorItem(
        item.id,
        productoId,
      );
      updateItem(item.id, resultado.data);
      if (resultado.variacionCosto.alerta === "alerta_fuerte") {
        toast.warning(
          `El costo varió más del 40% respecto al histórico para "${item.textoOriginal}"`,
        );
      } else if (resultado.variacionCosto.alerta === "advertencia") {
        toast.message(
          `El costo varió respecto al histórico para "${item.textoOriginal}"`,
        );
      }
      if (resultado.tipoCambioAplicado) {
        toast.message(
          `Costo convertido a ARS con cotización $${resultado.tipoCambioAplicado.toLocaleString("es-AR")}`,
        );
      } else if (resultado.advertenciaConversion) {
        toast.warning(resultado.advertenciaConversion);
      }
      onCreated?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al confirmar el item",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function ignorarItem(item: FacturaProveedorItem) {
    setBusyItemId(item.id);
    try {
      const actualizado = await apiService.ignoreFacturaProveedorItem(item.id);
      updateItem(item.id, actualizado);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al ignorar el item",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function confirmarTodosSeguros() {
    if (!factura) return;
    setConfirmandoTodos(true);
    try {
      const resultado = await apiService.confirmAllFacturaProveedor(factura.id);
      if (resultado.confirmados > 0)
        toast.success(`${resultado.confirmados} producto(s) confirmado(s)`);
      if (resultado.errores.length > 0) {
        resultado.errores.forEach((e) =>
          toast.error(`Item ${e.itemId}: ${e.error}`),
        );
      }
      const facturaActualizada = await apiService.getFacturaProveedor(
        factura.id,
      );
      setFactura(facturaActualizada);
      setItems(facturaActualizada.items ?? []);
      onCreated?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al confirmar en lote",
      );
    } finally {
      setConfirmandoTodos(false);
    }
  }

  function initialValuesParaNuevoProducto(
    item: FacturaProveedorItemConCatalogoGlobal,
  ): CreateProductoInitialValues {
    // El costo final que persiste el backend siempre queda en ARS (ver
    // create-product/route.ts) — acá sólo se prellena una estimación con la
    // cotización del momento para que el campo no se vea con un número en
    // USD sin aclarar. El valor real, autoritativo, lo calcula el backend.
    const moneda = (factura?.moneda ?? "ARS").trim().toUpperCase();
    const precioEstimadoArs =
      item.precioUnitario != null && moneda === "USD" && cotizacionDolar
        ? item.precioUnitario * cotizacionDolar
        : (item.precioUnitario ?? undefined);

    return {
      // Si hay una sugerencia del catálogo global, su nombre normalizado es
      // más limpio que el texto OCR crudo — pero sigue siendo editable, no se
      // fuerza nada (ver openspec/changes/catalogo-global-api).
      nombre: normalizarNombreSugerido(
        item.candidatoGlobalNombre ?? item.textoOriginal,
      ),
      precioCosto: precioEstimadoArs,
      precioVenta: precioVentaBorrador[item.id] ?? undefined,
      stockDisponibleUnits: item.cantidad,
      codigoBarra: inferirCodigoBarra(item) ?? item.candidatoGlobalCodigoBarras,
    };
  }

  const facturaBloqueada =
    factura?.estado === "CONFIRMADA" || factura?.estado === "CANCELADA";
  const monedaFactura = (factura?.moneda ?? "ARS").trim().toUpperCase();

  // La factura puede venir en una moneda extranjera (ej. USD). Para que el
  // usuario vea siempre los precios en pesos, se convierte en vivo con la
  // cotización del dólar blue. El backend hace la conversión autoritativa al
  // confirmar; acá es solo visual.
  const facturaEnMonedaExtranjera = monedaFactura !== "ARS";
  const puedeConvertir = facturaEnMonedaExtranjera && !!cotizacionDolar;

  function convertirAArs(valor: number | null | undefined): number | null {
    if (valor == null) return null;
    if (!facturaEnMonedaExtranjera) return valor;
    return cotizacionDolar ? valor * cotizacionDolar : null;
  }

  function formatearArs(valor: number): string {
    return `$${valor.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }

  // Líneas que realmente cuentan para el total/cantidad — un item ignorado
  // fue descartado explícitamente por el usuario porque no correspondía a
  // esta compra, así que no debe sumar.
  const itemsValidos = React.useMemo(
    () => (items ?? []).filter((i) => i.estado !== "IGNORADO"),
    [items],
  );

  // Total autocalculado a partir de las líneas (cantidad × costo unitario) —
  // no lo tipea el usuario: siempre refleja la suma real de lo que se está
  // cargando, y se recalcula solo si edita cantidad o costo de algún item.
  const totalCalculado = React.useMemo(
    () =>
      itemsValidos.reduce(
        (acc, i) => acc + i.cantidad * (i.precioUnitario ?? 0),
        0,
      ),
    [itemsValidos],
  );

  const cantidadTotalUnidades = itemsValidos.reduce(
    (acc, i) => acc + i.cantidad,
    0,
  );

  // Conteos por bucket para los chips de filtro y el resumen lateral.
  const conteos = React.useMemo(() => {
    const base: Record<FiltroFactura, number> = {
      todos: 0,
      pendiente: 0,
      confirmado: 0,
      "sin-match": 0,
      advertencia: 0,
    };
    for (const item of items ?? []) {
      base.todos += 1;
      for (const b of bucketsDeItem(item)) base[b] += 1;
    }
    return base;
  }, [items]);

  const itemsFiltrados = React.useMemo(() => {
    const lista = items ?? [];
    if (filtroActivo === "todos") return lista;
    return lista.filter((i) => bucketsDeItem(i).includes(filtroActivo));
  }, [items, filtroActivo]);

  // Progreso: cuántas líneas ya quedaron resueltas (confirmadas, con producto
  // creado o ignoradas) sobre el total detectado.
  const totalLineas = (items ?? []).length;
  const lineasResueltas = (items ?? []).filter((i) =>
    ESTADOS_TERMINALES.has(i.estado),
  ).length;
  const progresoPct =
    totalLineas > 0 ? Math.round((lineasResueltas / totalLineas) * 100) : 0;

  // Mantiene factura.totalDetectado sincronizado con la suma de líneas.
  React.useEffect(() => {
    if (!factura || !items || facturaBloqueada) return;
    const actual = factura.totalDetectado ?? 0;
    // Redondeo a centavos para no disparar el PATCH por errores de punto flotante.
    if (Math.round(actual * 100) === Math.round(totalCalculado * 100)) return;
    guardarCampoFactura({ totalDetectado: totalCalculado });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guardarCampoFactura no es estable entre renders; sólo debe dispararse cuando cambia el total calculado o la factura activa.
  }, [totalCalculado, factura?.id, facturaBloqueada]);

  // El código de proveedor no se muestra por separado si ya viene embebido en
  // la descripción detectada (evita duplicar el dato en pantalla).
  function codigoYaEnDescripcion(item: FacturaProveedorItem): boolean {
    const cod = item.codigoProveedor?.trim();
    if (!cod) return false;
    return item.textoOriginal.toLowerCase().includes(cod.toLowerCase());
  }

  // Ocultar el disparador si el plan no incluye la carga de facturas con IA.
  // Mientras se resuelve el cupo (usage === null) se muestra de forma
  // optimista: la mayoría de los planes tienen la feature habilitada, así
  // que el botón aparece de inmediato en el caso común en vez de esperar la
  // red — a costa de un posible flash breve para la minoría sin acceso.
  if (usage != null && !usage.hasFeature) return null;

  const itemRowCtx: FacturaItemRowContext = {
    productos,
    monedaFactura,
    puedeConvertir,
    convertirAArs,
    formatearArs,
    codigoYaEnDescripcion,
    busyItemId,
    precioVentaBorrador,
    setPrecioVentaBorrador,
    itemIdParaEditar,
    updateItem,
    guardarCampoItem,
    confirmarItem,
    ignorarItem,
    setItemIdParaMatch,
    setItemParaCrear,
    setItemIdParaEditar,
    setProductos,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* En modo controlado (retomar) sin trigger explícito, no renderizamos
            botón propio: la apertura la maneja quien lo usa. */}
        {(trigger !== undefined || controlledOpen === undefined) && (
          <DialogTrigger asChild>
            {trigger || (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 rounded-lg font-bold text-sm"
              >
                <ScanText className="h-3.5 w-3.5 mr-1.5" />
                Cargar por factura
              </Button>
            )}
          </DialogTrigger>
        )}

        <DialogContent
          className="p-0 gap-0 flex flex-col overflow-hidden border border-border bg-background rounded-2xl sm:rounded-[28px] shadow-2xl w-screen sm:w-[94vw] max-w-none sm:max-w-[1440px] h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[92vh]"
          onInteractOutside={(e) => {
            if (nestedDialogOpen || selectorArchivoAbiertoRef.current)
              e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (nestedDialogOpen) e.preventDefault();
          }}
        >
          <DialogHeader className="shrink-0 border-b border-border px-4 py-4 sm:px-8 sm:py-6 text-left">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-14 sm:w-14">
                <ScanText className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0 space-y-0.5 sm:space-y-1">
                <DialogTitle className="text-lg font-black italic tracking-tight sm:text-2xl">
                  {facturaIdInicial != null
                    ? "Retomar revisión de factura"
                    : "Escanear factura de compra"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
                  {items || facturaIdInicial != null
                    ? "Revisá los datos antes de actualizar el stock."
                    : "Subí o sacá una foto de la factura del proveedor para cargar stock automáticamente con IA."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {cargandoInicial && (
            <div className="flex flex-1 min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando la revisión…
            </div>
          )}

          {!items && !cargandoInicial && facturaIdInicial == null && (
            <FacturaUploadPane
              fileInputRef={fileInputRef}
              handleFileInput={handleFileInput}
              handleDrop={handleDrop}
              abrirSelectorArchivo={abrirSelectorArchivo}
              setDragActive={setDragActive}
              trabajoEnCurso={trabajando}
              subiendo={subiendo}
              selectedFile={selectedFile}
              usage={usage}
              sinCupo={sinCupo}
              dragActive={dragActive}
            />
          )}

          {items && factura && (
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                {/* ===== COLUMNA PRINCIPAL: contexto + tabla ===== */}
                <div className="flex min-w-0 flex-col gap-4">
                  {/* Progreso */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold">
                        {lineasResueltas} de {totalLineas} productos revisados
                      </span>
                      <span className="text-muted-foreground">
                        {totalLineas - lineasResueltas === 0
                          ? "Todo listo"
                          : `Quedan ${totalLineas - lineasResueltas}`}
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={progresoPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Progreso de revisión de productos"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${progresoPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Datos generales */}
                  <FacturaDatosGenerales
                    ctx={{
                      factura,
                      proveedores,
                      itemsValidos,
                      cantidadTotalUnidades,
                      totalCalculado,
                      monedaFactura,
                      facturaEnMonedaExtranjera,
                      puedeConvertir,
                      cotizacionDolar,
                      facturaBloqueada,
                      formatearArs,
                      convertirAArs,
                      updateFacturaLocal,
                      guardarCampoFactura,
                      cambiarMonedaFactura,
                    }}
                  />

                  {items.length > 0 ? (
                    <>
                      {/* Confianza + filtros */}
                      <p className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm text-foreground">
                        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                        <span>
                          <b>{conteos.confirmado}</b> de <b>{totalLineas}</b> ya
                          se relacionaron solos. Revisá los{" "}
                          <b>{conteos.pendiente}</b> marcados — nada cambia
                          hasta confirmar.
                        </span>
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            ["todos", "Todos"],
                            ["pendiente", "Pendientes"],
                            ["confirmado", "Confirmados"],
                            ["sin-match", "Sin match"],
                            ["advertencia", "Advertencias"],
                          ] as [FiltroFactura, string][]
                        ).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={filtroActivo === key}
                            onClick={() => setFiltroActivo(key)}
                            className={cn(
                              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                              filtroActivo === key
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-background text-muted-foreground hover:border-foreground/40",
                            )}
                          >
                            {label}
                            <span className="font-mono text-xs opacity-70">
                              {conteos[key]}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Lista de productos: grilla en pantallas anchas, tarjetas
                          apiladas en angostas. minmax(0,1fr) en Producto permite
                          que la descripción encoja sin romper el resto. */}
                      <TooltipProvider>
                        <div className="overflow-hidden rounded-2xl border border-border bg-card">
                          {/* Encabezado (solo en grilla) */}
                          <div className="hidden gap-3 border-b border-border bg-muted/50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_72px_112px_112px_130px_auto]">
                            <span>Producto</span>
                            <span>Cant.</span>
                            <span>Costo ({monedaFactura})</span>
                            <span>P. venta</span>
                            <span>Estado</span>
                            <span className="text-right">Acciones</span>
                          </div>

                          <div className="divide-y divide-border">
                            {itemsFiltrados.length === 0 ? (
                              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                No hay productos en este filtro.
                              </div>
                            ) : (
                              itemsFiltrados.map((item) => (
                                <FacturaItemRow key={item.id} item={item} ctx={itemRowCtx} />
                              ))
                            )}
                          </div>
                        </div>
                      </TooltipProvider>
                    </>
                  ) : (
                    <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">
                      No se detectaron líneas de producto. Probá con otra
                      imagen.
                    </div>
                  )}
                </div>

                {/* ===== COLUMNA LATERAL: preview + resumen ===== */}
                <FacturaResumenLateral
                  ctx={{
                    factura,
                    conteos,
                    monedaFactura,
                    totalCalculado,
                    puedeConvertir,
                    formatearArs,
                    convertirAArs,
                    imagenPreviewError,
                    setImagenPreviewError,
                    setConfirmarProveedorOpen,
                    confirmandoTodos,
                    facturaBloqueada,
                  }}
                />
              </div>
            </div>
          )}

          <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-8 sm:py-5">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              {selectedFile && (
                <>
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </span>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--status-success-strong)]" />
                </>
              )}
            </div>
            <div className="flex shrink-0 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 whitespace-nowrap px-6"
                onClick={() => setOpen(false)}
                disabled={trabajando}
              >
                {items && factura ? "Cerrar" : "Cancelar"}
              </Button>
              {/* En la vista de revisión el CTA principal ("Confirmar ingreso")
                  vive en el panel de resumen; el pie sólo ofrece cerrar.
                  En modo retomar tampoco hay que analizar nada nuevo. */}
              {!items && !cargandoInicial && facturaIdInicial == null && (
                <Button
                  type="button"
                  className="h-11 shrink-0 whitespace-nowrap px-6 font-semibold"
                  onClick={analizarFactura}
                  disabled={!selectedFile || trabajando || sinCupo}
                >
                  {trabajando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanText className="h-4 w-4" />
                  )}
                  Analizar factura
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <FacturaCompanionDialogs
        ctx={{
          factura,
          items,
          productos,
          itemParaCrear,
          itemIdParaMatch,
          confirmarProveedorOpen,
          onCreated,
          initialValuesParaNuevoProducto,
          confirmarTodosSeguros,
          updateItem,
          setItemParaCrear,
          setItemIdParaMatch,
          setConfirmarProveedorOpen,
        }}
      />
    </>
  );
}
