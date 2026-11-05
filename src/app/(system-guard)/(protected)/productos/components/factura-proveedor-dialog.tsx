"use client";

import * as React from "react";
import {
  apiService,
  type FacturaProveedorItem,
  type Proveedor,
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
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { FacturaUploadPane } from "./factura-upload-pane";
import { FacturaItemRow, type FacturaItemRowContext } from "./factura-item-row";
import { FacturaResumenLateral } from "./factura-resumen-lateral";
import { FacturaDatosGenerales } from "./factura-datos-generales";
import { FacturaCompanionDialogs } from "./factura-companion-dialogs";
import { FacturaFiltros, FacturaProgreso } from "./factura-revision-header";
import { useFacturaItems } from "./use-factura-items";
import { useFacturaDerivados } from "./use-factura-derivados";
import { useFacturaUpload } from "./use-factura-upload";

import { type FiltroFactura } from "./factura-proveedor-helpers";


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
  const [productos, setProductos] = React.useState<Producto[]>([]);
  const [proveedores, setProveedores] = React.useState<Proveedor[]>([]);
  const { rate: cotizacionDolar } = useDolarBlue();

  const {
    factura,
    setFactura,
    items,
    setItems,
    busyItemId,
    confirmandoTodos,
    monedaFactura,
    updateItem,
    updateFacturaLocal,
    guardarCampoFactura,
    guardarCampoItem,
    cambiarMonedaFactura,
    confirmarItem,
    ignorarItem,
    confirmarTodosSeguros,
  } = useFacturaItems({ cotizacionDolar, onCreated });

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

  const {
    initialValuesParaNuevoProducto,
    facturaBloqueada,
    facturaEnMonedaExtranjera,
    puedeConvertir,
    convertirAArs,
    formatearArs,
    itemsValidos,
    totalCalculado,
    cantidadTotalUnidades,
    conteos,
    itemsFiltrados,
    totalLineas,
    lineasResueltas,
    progresoPct,
    codigoYaEnDescripcion,
  } = useFacturaDerivados({
    factura,
    items,
    monedaFactura,
    cotizacionDolar,
    filtroActivo,
    precioVentaBorrador,
    guardarCampoFactura,
  });
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
                  <FacturaProgreso
                    lineasResueltas={lineasResueltas}
                    totalLineas={totalLineas}
                    progresoPct={progresoPct}
                  />

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
                      <FacturaFiltros
                        conteos={conteos}
                        totalLineas={totalLineas}
                        filtroActivo={filtroActivo}
                        setFiltroActivo={setFiltroActivo}
                      />

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
