"use client";

import * as React from "react";
import {
  apiService,
  API_ROUTES,
  type FacturaProveedor,
  type FacturaProveedorItem,
  type FacturaProveedorUsage,
  type Proveedor,
  type UpdateFacturaProveedorInput,
  type UpdateFacturaProveedorItemInput,
} from "@/lib/apiService";
import type { Producto } from "@/lib/types";
import { useDolarBlue } from "@/hooks/useDolarBlue";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ScanText,
  Loader2,
  CheckCircle2,
  Sparkles,
  FileText,
  User,
  Building2,
  Hash,
  Calendar,
  CircleDollarSign,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import {
  CreateProductoDialog,
  type CreateProductoInitialValues,
  type ProductoCreado,
} from "./create-producto-dialog";
import { SeleccionarProductoExistenteDialog } from "./seleccionar-producto-existente-dialog";
import { FacturaUploadPane } from "./factura-upload-pane";
import { FacturaItemRow, type FacturaItemRowContext } from "./factura-item-row";
import { cn } from "@/lib/utils";

import {
  DATO_FIELD_CLASS,
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
  const [cargandoInicial, setCargandoInicial] = React.useState(false);
  const [subiendo, setSubiendo] = React.useState(false);
  const [procesando, setProcesando] = React.useState(false);
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
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  // La vista previa de la factura carga el archivo original vía /archivo; si
  // falla (permisos, archivo purgado tras confirmar) se muestra un fallback.
  const [imagenPreviewError, setImagenPreviewError] = React.useState(false);
  const [usage, setUsage] = React.useState<FacturaProveedorUsage | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Evita que Radix cierre el Dialog al volver del selector nativo de
  // archivos (cámara/galería) en mobile — ver openspec/changes/fix-carga-factura-mobile.
  const selectorArchivoAbiertoRef = React.useRef(false);

  // Consulta el cupo al montar para decidir si mostrar el disparador: los
  // planes sin OCR (hasFeature === false) ocultan el botón por completo.
  React.useEffect(() => {
    apiService
      .getFacturaProveedorUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);

  React.useEffect(() => {
    if (!open) {
      setFactura(null);
      setItems(null);
      setSubiendo(false);
      setProcesando(false);
      setCargandoInicial(false);
      setSelectedFile(null);
      setDragActive(false);
      setFiltroActivo("todos");
      setItemParaCrear(null);
      setItemIdParaMatch(null);
      setPrecioVentaBorrador({});
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const trabajando = subiendo || procesando;
  const sinCupo =
    usage != null &&
    (!usage.hasFeature || (usage.limit !== -1 && usage.used >= usage.limit));

  // Red de seguridad: si el navegador no dispara "cancel" en el <input
  // type="file"> (algunos no lo hacen), limpiar el guard cuando la ventana
  // recupera el foco — pasa siempre al volver de la cámara/galería nativa,
  // se haya elegido un archivo o no.
  React.useEffect(() => {
    function onWindowFocus() {
      if (!selectorArchivoAbiertoRef.current) return;
      window.setTimeout(() => {
        selectorArchivoAbiertoRef.current = false;
      }, 300);
    }
    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, []);

  // El tipado de React no incluye el evento nativo "cancel" de <input
  // type="file"> — se engancha imperativamente en vez de vía JSX onCancel.
  React.useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    function onCancel() {
      selectorArchivoAbiertoRef.current = false;
    }
    input.addEventListener("cancel", onCancel);
    return () => input.removeEventListener("cancel", onCancel);
  }, []);

  function abrirSelectorArchivo() {
    if (trabajando || sinCupo) return;
    selectorArchivoAbiertoRef.current = true;
    fileInputRef.current?.click();
  }

  function elegirArchivo(file: File | null | undefined) {
    if (!file || trabajando) return;
    setSelectedFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    selectorArchivoAbiertoRef.current = false;
    elegirArchivo(e.target.files?.[0]);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    elegirArchivo(e.dataTransfer.files?.[0]);
  }

  async function analizarFactura() {
    if (!selectedFile || trabajando) return;

    setSubiendo(true);
    try {
      const subida = await apiService.uploadFacturaProveedor(selectedFile);
      setSubiendo(false);
      setProcesando(true);
      const procesada = await apiService.processFacturaProveedor(subida.id);
      setFactura(procesada);
      setItems(procesada.items ?? []);
      if ((procesada.items ?? []).length === 0) {
        toast.warning(
          "No se detectaron líneas de producto en la factura. Probá con otra foto más nítida.",
        );
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al procesar la factura",
      );
      setFactura(null);
      setItems(null);
    } finally {
      setSubiendo(false);
      setProcesando(false);
    }
  }

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
                  <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-base font-black italic tracking-tight">
                        Datos generales
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        Editá lo que necesites
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Proveedor
                        </Label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Select
                            value={
                              factura.proveedorId
                                ? String(factura.proveedorId)
                                : "none"
                            }
                            onValueChange={(v) =>
                              guardarCampoFactura({
                                proveedorId: v === "none" ? null : Number(v),
                              })
                            }
                            disabled={facturaBloqueada}
                          >
                            <SelectTrigger
                              className={cn(DATO_FIELD_CLASS, "w-full pl-9")}
                            >
                              <SelectValue placeholder="Sin asignar" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              align="start"
                              sideOffset={4}
                            >
                              <SelectItem value="none">Sin asignar</SelectItem>
                              {proveedores.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Nombre detectado
                        </Label>
                        <div className="relative">
                          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={factura.proveedorNombreDetectado ?? ""}
                            onChange={(e) =>
                              updateFacturaLocal({
                                proveedorNombreDetectado: e.target.value,
                              })
                            }
                            onBlur={(e) =>
                              guardarCampoFactura({
                                proveedorNombreDetectado:
                                  e.target.value || null,
                              })
                            }
                            disabled={facturaBloqueada}
                            placeholder="No detectado"
                            className={cn(DATO_FIELD_CLASS, "pl-9")}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          CUIT
                        </Label>
                        <div className="relative">
                          <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={factura.proveedorCuitDetectado ?? ""}
                            onChange={(e) =>
                              updateFacturaLocal({
                                proveedorCuitDetectado: e.target.value,
                              })
                            }
                            onBlur={(e) =>
                              guardarCampoFactura({
                                proveedorCuitDetectado: e.target.value || null,
                              })
                            }
                            disabled={facturaBloqueada}
                            placeholder="No detectado"
                            className={cn(DATO_FIELD_CLASS, "pl-9 font-mono")}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          N° de factura
                        </Label>
                        <div className="relative">
                          <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={factura.numeroFactura ?? ""}
                            onChange={(e) =>
                              updateFacturaLocal({
                                numeroFactura: e.target.value,
                              })
                            }
                            onBlur={(e) =>
                              guardarCampoFactura({
                                numeroFactura: e.target.value || null,
                              })
                            }
                            disabled={facturaBloqueada}
                            placeholder="—"
                            className={cn(DATO_FIELD_CLASS, "pl-9 font-mono")}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Fecha
                        </Label>
                        <div className="relative">
                          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="date"
                            value={
                              factura.fecha ? factura.fecha.slice(0, 10) : ""
                            }
                            onChange={(e) =>
                              updateFacturaLocal({
                                fecha: e.target.value || null,
                              })
                            }
                            onBlur={(e) =>
                              guardarCampoFactura({
                                fecha: e.target.value || null,
                              })
                            }
                            disabled={facturaBloqueada}
                            className={cn(DATO_FIELD_CLASS, "pl-9")}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Moneda
                        </Label>
                        <div className="relative">
                          <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Select
                            value={monedaFactura}
                            onValueChange={cambiarMonedaFactura}
                            disabled={facturaBloqueada}
                          >
                            <SelectTrigger
                              className={cn(DATO_FIELD_CLASS, "w-full pl-9")}
                            >
                              <SelectValue placeholder="ARS" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              align="start"
                              sideOffset={4}
                            >
                              <SelectItem value="ARS">ARS</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                              {monedaFactura !== "ARS" &&
                                monedaFactura !== "USD" && (
                                  <SelectItem value={monedaFactura}>
                                    {monedaFactura}
                                  </SelectItem>
                                )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Productos
                          <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">
                            calc.
                          </span>
                        </Label>
                        <div
                          className={cn(
                            DATO_FIELD_CLASS,
                            "flex items-center px-3 font-semibold tabular-nums text-foreground",
                          )}
                        >
                          {itemsValidos.length}{" "}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            líneas
                          </span>
                        </div>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Total ({monedaFactura})
                          <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">
                            calc.
                          </span>
                        </Label>
                        <div
                          className={cn(
                            DATO_FIELD_CLASS,
                            "flex items-center px-3 font-semibold tabular-nums text-foreground",
                          )}
                          title="Se calcula automáticamente: cantidad × costo unitario de cada línea"
                        >
                          {totalCalculado.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Unidades totales:{" "}
                        <b className="text-foreground tabular-nums">
                          {cantidadTotalUnidades}
                        </b>
                      </span>
                      {facturaEnMonedaExtranjera && (
                        <span>
                          {puedeConvertir && totalCalculado > 0 ? (
                            <>
                              Total convertido:{" "}
                              <b className="text-primary tabular-nums">
                                {formatearArs(convertirAArs(totalCalculado)!)}{" "}
                                ARS
                              </b>
                              {cotizacionDolar
                                ? ` (dólar $${cotizacionDolar.toLocaleString("es-AR")})`
                                : ""}
                            </>
                          ) : (
                            "El costo se convierte a ARS al confirmar."
                          )}
                        </span>
                      )}
                    </div>
                  </div>

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
                <div className="flex flex-col gap-4 xl:sticky xl:top-0">
                  {/* Vista previa de la factura */}
                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Factura escaneada
                    </div>
                    <div className="flex items-center justify-center bg-muted/30 p-3">
                      {factura.archivoEliminado ? (
                        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                          <FileText className="h-8 w-8 opacity-40" />
                          El archivo original ya no está disponible.
                        </div>
                      ) : imagenPreviewError ? (
                        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                          <FileText className="h-8 w-8 opacity-40" />
                          No se pudo cargar la imagen original.
                        </div>
                      ) : factura.archivoMime?.startsWith("image/") ? (
                        <a
                          href={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(
                            factura.id,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-full"
                          title="Abrir la factura original en tamaño completo"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(
                              factura.id,
                            )}
                            alt="Factura escaneada"
                            className="mx-auto max-h-[320px] w-full cursor-zoom-in rounded-lg object-contain"
                            onError={() => setImagenPreviewError(true)}
                          />
                        </a>
                      ) : factura.archivoMime === "application/pdf" ? (
                        <a
                          href={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(
                            factura.id,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg text-sm font-medium text-primary hover:underline"
                        >
                          <FileText className="h-8 w-8" />
                          Abrir PDF original
                        </a>
                      ) : (
                        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
                          <FileText className="h-8 w-8 opacity-40" />
                          Sin vista previa disponible.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumen de la revisión */}
                  <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <h3 className="mb-3 text-base font-black italic tracking-tight">
                      Resumen de la revisión
                    </h3>
                    <div className="mb-3 border-b border-border pb-3">
                      <p className="truncate font-semibold">
                        {factura.proveedor?.nombre ??
                          factura.proveedorNombreDetectado ??
                          "Proveedor sin asignar"}
                      </p>
                      {(factura.proveedor?.cuit ??
                        factura.proveedorCuitDetectado) && (
                        <p className="font-mono text-xs text-muted-foreground">
                          CUIT{" "}
                          {factura.proveedor?.cuit ??
                            factura.proveedorCuitDetectado}
                        </p>
                      )}
                    </div>
                    <dl className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Detectados</dt>
                        <dd className="font-mono font-bold tabular-nums">
                          {conteos.todos}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Confirmados</dt>
                        <dd className="font-mono font-bold tabular-nums text-[color:var(--status-success-strong)]">
                          {conteos.confirmado}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Pendientes</dt>
                        <dd className="font-mono font-bold tabular-nums text-[color:var(--status-warning)]">
                          {conteos.pendiente}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">
                          Sin coincidencia
                        </dt>
                        <dd className="font-mono font-bold tabular-nums text-[color:var(--status-danger)]">
                          {conteos["sin-match"]}
                        </dd>
                      </div>
                    </dl>
                    <div className="my-3 space-y-1.5 border-y border-border py-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Total ({monedaFactura})
                        </span>
                        <span className="font-mono font-semibold tabular-nums">
                          {totalCalculado.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      {puedeConvertir && totalCalculado > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Convertido
                          </span>
                          <span className="font-mono text-base font-extrabold tabular-nums">
                            {formatearArs(convertirAArs(totalCalculado)!)}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      className="h-11 w-full rounded-full font-bold shadow-lg shadow-primary/20"
                      onClick={() => setConfirmarProveedorOpen(true)}
                      disabled={confirmandoTodos || facturaBloqueada}
                    >
                      {confirmandoTodos ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Confirmar ingreso
                    </Button>
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Nada se actualiza hasta confirmar.
                    </p>
                  </div>

                  {/* Barra de confianza */}
                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ScanLine className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold">Seguridad</p>
                        <p className="text-[11px] text-muted-foreground">
                          Tu info está protegida
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold">Sin riesgos</p>
                        <p className="text-[11px] text-muted-foreground">
                          Editá u omití antes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold">Control total</p>
                        <p className="text-[11px] text-muted-foreground">
                          Vos tenés la última palabra
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
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

      {itemParaCrear && (
        <CreateProductoDialog
          open={Boolean(itemParaCrear)}
          onOpenChange={(v) => {
            if (!v) setItemParaCrear(null);
          }}
          initialValues={initialValuesParaNuevoProducto(itemParaCrear)}
          submitFn={(payload) =>
            apiService
              .createProductoDesdeFacturaItem(itemParaCrear.id, payload)
              .then((res): ProductoCreado => {
                if (res.tipoCambioAplicado) {
                  toast.message(
                    `Costo convertido a ARS con cotización $${res.tipoCambioAplicado.toLocaleString("es-AR")}`,
                  );
                } else if (res.advertenciaConversion) {
                  toast.warning(res.advertenciaConversion);
                }
                return {
                  id: res.producto.id,
                  nombre: res.producto.nombre,
                  sku: null,
                  codigoBarra: res.producto.codigoBarra ?? null,
                  stockDisponibleUnits: Number(
                    (res.producto as { stockDisponibleUnits?: unknown })
                      .stockDisponibleUnits ?? 0,
                  ),
                };
              })
          }
          onProductoCreado={() => {
            updateItem(itemParaCrear.id, { estado: "PRODUCTO_CREADO" });
            setItemParaCrear(null);
            onCreated?.();
          }}
        />
      )}

      <SeleccionarProductoExistenteDialog
        open={itemIdParaMatch !== null}
        onOpenChange={(v) => {
          if (!v) setItemIdParaMatch(null);
        }}
        productos={productos}
        productoIdSeleccionado={
          items?.find((i) => i.id === itemIdParaMatch)?.productoId ?? null
        }
        onSelect={(productoId) => {
          if (itemIdParaMatch !== null)
            updateItem(itemIdParaMatch, { productoId });
        }}
      />

      <AlertDialog
        open={confirmarProveedorOpen}
        onOpenChange={setConfirmarProveedorOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Confirmá los datos del proveedor
            </AlertDialogTitle>
            <AlertDialogDescription>
              {factura?.proveedorId
                ? "Este proveedor se asignó automáticamente a partir de lo que detectó la IA. Revisá que sea correcto antes de confirmar los productos — el aprendizaje de futuras facturas (códigos y alias) se guarda contra este proveedor."
                : "No se pudo asignar ningún proveedor para esta factura. Podés confirmar los productos igual, pero no se va a guardar ningún alias para reconocerlos más rápido la próxima vez."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Nombre</span>
              <span className="font-medium text-right truncate">
                {factura?.proveedor?.nombre ??
                  factura?.proveedorNombreDetectado ??
                  "Sin detectar"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">CUIT</span>
              <span className="font-mono text-right">
                {factura?.proveedor?.cuit ??
                  factura?.proveedorCuitDetectado ??
                  "Sin detectar"}
              </span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar antes</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmarProveedorOpen(false);
                confirmarTodosSeguros();
              }}
            >
              Es correcto, confirmar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
