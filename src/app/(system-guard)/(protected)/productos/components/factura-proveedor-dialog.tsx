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
import { formatMoney } from "@/lib/date-format/utils-format";
import { digitosAMonto, formatearInputMonto } from "@/lib/money-input";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ScanText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Check,
  X,
  FileText,
  User,
  Building2,
  Hash,
  Calendar,
  CircleDollarSign,
  ScanLine,
  Package,
  Plus,
  PencilLine,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  CreateProductoDialog,
  type CreateProductoInitialValues,
  type ProductoCreado,
} from "./create-producto-dialog";
import { EditProductoDialog } from "./edit-producto-dialog";
import { SeleccionarProductoExistenteDialog } from "./seleccionar-producto-existente-dialog";
import { cn } from "@/lib/utils";

const ESTADOS_TERMINALES = new Set([
  "CONFIRMADO",
  "PRODUCTO_CREADO",
  "IGNORADO",
]);

function badgeEstado(item: FacturaProveedorItem) {
  switch (item.estado) {
    case "COINCIDENCIA_SEGURA":
      return {
        label: `${item.producto?.nombre ?? "Producto sugerido"} (${Math.round((item.matchScore ?? 0) * 100)}%)`,
        cls: "text-[color:var(--status-success-strong)]",
        icon: CheckCircle2,
      };
    case "COINCIDENCIA_PROBABLE":
      return {
        label: `${item.producto?.nombre ?? "Producto sugerido"} (${Math.round((item.matchScore ?? 0) * 100)}%)`,
        cls: "text-[color:var(--status-success-strong)]",
        icon: CheckCircle2,
      };
    case "REQUIERE_REVISION":
      return {
        label: "Revisar manualmente",
        cls: "text-[color:var(--status-warning)]",
        icon: HelpCircle,
      };
    case "SIN_COINCIDENCIA":
      return {
        label: "Sin coincidencia",
        cls: "text-muted-foreground",
        icon: XCircle,
      };
    case "CONFIRMADO":
      return {
        label: "Confirmado",
        cls: "text-[color:var(--status-success-strong)]",
        icon: CheckCircle2,
      };
    case "PRODUCTO_CREADO":
      return {
        label: "Producto creado",
        cls: "text-[color:var(--status-success-strong)]",
        icon: Sparkles,
      };
    case "IGNORADO":
      return { label: "Ignorado", cls: "text-muted-foreground", icon: XCircle };
    default:
      return {
        label: "Pendiente",
        cls: "text-muted-foreground",
        icon: HelpCircle,
      };
  }
}

function normalizarNombreSugerido(textoOriginal: string): string {
  return textoOriginal.trim();
}

function inferirCodigoBarra(item: FacturaProveedorItem): string | null {
  const candidato = item.codigoProveedor?.trim() ?? "";
  if (!/^\d{8,14}$/.test(candidato)) return null;
  return candidato;
}

type FiltroFactura =
  "todos" | "pendiente" | "confirmado" | "sin-match" | "advertencia";

// Nivel de confianza del match para el chip de la tabla. Deriva del matchScore
// que ya calcula el motor de matching (0..1); un item sin producto asociado no
// tiene confianza real, se muestra como "baja".
type NivelConfianza = "excelente" | "buena" | "baja";
function nivelConfianza(item: FacturaProveedorItem): {
  nivel: NivelConfianza;
  pct: number | null;
} {
  if (!item.productoId) return { nivel: "baja", pct: null };
  const pct = Math.round((item.matchScore ?? 0) * 100);
  if (pct >= 95) return { nivel: "excelente", pct };
  if (pct >= 70) return { nivel: "buena", pct };
  return { nivel: "baja", pct };
}

// Agrupa el estado del item en los buckets que usan los filtros de la pantalla.
function bucketsDeItem(item: FacturaProveedorItem): FiltroFactura[] {
  const buckets: FiltroFactura[] = [];
  const terminal = ESTADOS_TERMINALES.has(item.estado);
  if (item.estado === "CONFIRMADO" || item.estado === "PRODUCTO_CREADO") {
    buckets.push("confirmado");
  } else if (item.estado !== "IGNORADO") {
    buckets.push("pendiente");
  }
  if (!terminal && item.estado === "SIN_COINCIDENCIA")
    buckets.push("sin-match");
  if (item.advertencias.length > 0) buckets.push("advertencia");
  return buckets;
}

const TIPS_FOTO: { ok: boolean; texto: string }[] = [
  { ok: true, texto: "Buena iluminación" },
  { ok: true, texto: "Texto legible" },
  { ok: true, texto: "Factura completa visible" },
  { ok: false, texto: "Sin reflejos ni sombras" },
  { ok: false, texto: "No capturas de pantalla" },
];

const ACCEPT_FACTURA = "image/png,image/jpeg,image/webp,application/pdf";

// Campos del rediseño de la pantalla de revisión (grilla de datos y celdas de
// la tabla). Mismo lenguaje visual de la app (rounded-xl, shadow-xs) pero
// compactos para que la tabla respire.
const DATO_FIELD_CLASS =
  "h-10 rounded-xl border-border bg-background text-sm shadow-xs";
const TABLE_ACTION_ICON_CLASS =
  "size-8 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-primary/60";

type FacturaProveedorItemConCatalogoGlobal = FacturaProveedorItem & {
  candidatoGlobalNombre?: string | null;
  candidatoGlobalCodigoBarras?: string | null;
  candidatoGlobalScore?: number | null;
};

export function FacturaProveedorDialog({
  trigger,
  onCreated,
}: {
  trigger?: React.ReactNode;
  onCreated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
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
  }, [open]);

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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
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
                  Escanear factura de compra
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
                  {items
                    ? "Revisá los datos antes de actualizar el stock."
                    : "Subí o sacá una foto de la factura del proveedor para cargar stock automáticamente con IA."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {!items && (
            <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_FACTURA}
                onChange={handleFileInput}
                disabled={trabajando}
                className="hidden"
              />

              {usage && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
                  <span className="text-muted-foreground">
                    Escaneos usados este mes
                  </span>
                  <span className="font-semibold tabular-nums">
                    {usage.used} / {usage.limit === -1 ? "∞" : usage.limit}
                  </span>
                </div>
              )}

              <div
                role="button"
                tabIndex={0}
                onClick={() => abrirSelectorArchivo()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    abrirSelectorArchivo();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!trabajando && !sinCupo) setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(e) => {
                  if (sinCupo) {
                    e.preventDefault();
                    return;
                  }
                  handleDrop(e);
                }}
                aria-disabled={sinCupo}
                className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none ${
                  sinCupo
                    ? "opacity-50 cursor-not-allowed border-border"
                    : "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                } ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/60 hover:bg-muted/40"
                }`}
              >
                <div className="relative mx-auto mb-5 flex h-32 w-28 items-center justify-center">
                  {/* Marco de escáner */}
                  <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 rounded-tl-md border-l-2 border-t-2 border-primary" />
                  <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 rounded-tr-md border-r-2 border-t-2 border-primary" />
                  <span className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 rounded-bl-md border-b-2 border-l-2 border-primary" />
                  <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 rounded-br-md border-b-2 border-r-2 border-primary" />
                  {/* Documento simulado */}
                  <div className="flex h-24 w-16 flex-col gap-1.5 rounded-md bg-muted/60 p-2">
                    <span className="h-1.5 w-3/4 rounded-full bg-primary/70" />
                    <span className="h-1 w-full rounded-full bg-foreground/20" />
                    <span className="h-1 w-5/6 rounded-full bg-foreground/20" />
                    <span className="h-1 w-full rounded-full bg-foreground/20" />
                    <span className="h-1 w-2/3 rounded-full bg-foreground/20" />
                    <span className="mt-auto h-1.5 w-1/2 rounded-full bg-primary/70" />
                  </div>
                  {/* Check de éxito */}
                  <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--status-success-strong)] text-white shadow">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                </div>

                {trabajando ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {subiendo
                      ? "Subiendo factura..."
                      : "Procesando con IA, puede tardar unos segundos..."}
                  </div>
                ) : selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    <span
                      className="max-w-[280px] truncate"
                      title={selectedFile.name}
                    >
                      {selectedFile.name}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-bold text-foreground">
                      Tocá para subir o arrastrá un archivo
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Foto (JPG, PNG, WEBP · 5 MB) o PDF · 10 MB
                    </p>
                  </>
                )}

                <div className="mx-auto mt-5 grid max-w-md grid-cols-1 gap-x-6 gap-y-1.5 text-left text-xs sm:grid-cols-2">
                  {TIPS_FOTO.map((tip) => (
                    <div key={tip.texto} className="flex items-center gap-1.5">
                      {tip.ok ? (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-[color:var(--status-success-strong)]"
                          strokeWidth={3}
                        />
                      ) : (
                        <X
                          className="h-3.5 w-3.5 shrink-0 text-destructive"
                          strokeWidth={3}
                        />
                      )}
                      <span
                        className={
                          tip.ok
                            ? "text-[color:var(--status-success-strong)]"
                            : "text-destructive"
                        }
                      >
                        {tip.texto}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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

                      {/* Tabla de productos (scroll horizontal en pantallas chicas) */}
                      <TooltipProvider>
                        <div className="overflow-hidden rounded-2xl border border-border bg-card">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] border-collapse text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  <th className="px-3 py-2 pl-4 font-semibold">
                                    Producto
                                  </th>
                                  <th className="w-14 px-2 py-2 font-semibold">
                                    Cant.
                                  </th>
                                  <th className="w-[92px] px-2 py-2 font-semibold">
                                    Costo ({monedaFactura})
                                  </th>
                                  <th className="w-[92px] px-2 py-2 font-semibold">
                                    P. venta
                                  </th>
                                  <th className="w-[116px] px-2 py-2 font-semibold">
                                    Estado
                                  </th>
                                  <th className="w-[108px] px-2 py-2 pr-3 text-right font-semibold">
                                    Acciones
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemsFiltrados.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={6}
                                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                                    >
                                      No hay productos en este filtro.
                                    </td>
                                  </tr>
                                ) : (
                                  itemsFiltrados.map((item) => {
                                    const badge = badgeEstado(item);
                                    const BadgeIcon = badge.icon;
                                    const terminal = ESTADOS_TERMINALES.has(
                                      item.estado,
                                    );
                                    const busy = busyItemId === item.id;
                                    const mostrarCodigo =
                                      !codigoYaEnDescripcion(item);
                                    const costoArs = puedeConvertir
                                      ? convertirAArs(item.precioUnitario)
                                      : null;
                                    const requiereAlta = !item.productoId;
                                    const productoMatch = item.productoId
                                      ? productos.find(
                                          (p) => p.id === item.productoId,
                                        )
                                      : undefined;
                                    const conf = nivelConfianza(item);
                                    const confCls =
                                      conf.nivel === "excelente"
                                        ? "text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/12"
                                        : conf.nivel === "buena"
                                          ? "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/12"
                                          : "text-[color:var(--status-danger)] bg-[color:var(--status-danger)]/12";
                                    const bordeEstado =
                                      item.estado === "CONFIRMADO" ||
                                      item.estado === "PRODUCTO_CREADO"
                                        ? "before:bg-[color:var(--status-success-strong)]"
                                        : item.estado === "SIN_COINCIDENCIA"
                                          ? "before:bg-[color:var(--status-danger)]"
                                          : item.estado === "IGNORADO"
                                            ? "before:bg-border"
                                            : "before:bg-[color:var(--status-warning)]";

                                    return (
                                      <tr
                                        key={item.id}
                                        className={cn(
                                          "relative border-b border-border align-top transition-colors last:border-b-0",
                                          "before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:content-['']",
                                          bordeEstado,
                                          terminal
                                            ? "bg-muted/25 opacity-70"
                                            : "hover:bg-muted/30",
                                        )}
                                      >
                                        {/* Producto: descripción editable + código + botón de match */}
                                        <td className="px-3 py-2.5 pl-4 align-top">
                                          <div className="flex items-start gap-2">
                                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                                              <Package className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-1">
                                              <Input
                                                aria-label={`Descripción detectada para línea ${item.id}`}
                                                value={item.textoOriginal}
                                                onChange={(e) =>
                                                  updateItem(item.id, {
                                                    textoOriginal:
                                                      e.target.value,
                                                  })
                                                }
                                                onBlur={(e) =>
                                                  guardarCampoItem(item, {
                                                    textoOriginal:
                                                      e.target.value,
                                                  })
                                                }
                                                disabled={terminal || busy}
                                                className={cn(
                                                  "h-8 rounded-lg border-border bg-background text-sm font-medium shadow-xs",
                                                )}
                                              />
                                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                {mostrarCodigo &&
                                                  item.codigoProveedor && (
                                                    <span className="font-mono text-[11px] text-muted-foreground">
                                                      #{item.codigoProveedor}
                                                    </span>
                                                  )}
                                                {!terminal && (
                                                  <button
                                                    type="button"
                                                    aria-label={`Producto existente para ${item.textoOriginal}`}
                                                    onClick={() =>
                                                      setItemIdParaMatch(
                                                        item.id,
                                                      )
                                                    }
                                                    disabled={busy}
                                                    className={cn(
                                                      "inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50",
                                                      productoMatch
                                                        ? "text-foreground"
                                                        : "text-muted-foreground",
                                                    )}
                                                  >
                                                    <Search className="h-3 w-3 shrink-0 opacity-70" />
                                                    <span className="truncate">
                                                      {productoMatch
                                                        ? productoMatch.nombre
                                                        : "Elegir producto"}
                                                    </span>
                                                  </button>
                                                )}
                                                {terminal && productoMatch && (
                                                  <span className="truncate text-xs text-muted-foreground">
                                                    {productoMatch.nombre}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </td>

                                        {/* Cantidad */}
                                        <td className="px-2 py-2.5 align-top">
                                          <Input
                                            aria-label={`Cantidad para ${item.textoOriginal}`}
                                            type="number"
                                            min={1}
                                            step="1"
                                            value={item.cantidad}
                                            onChange={(e) => {
                                              const n = Number(e.target.value);
                                              if (Number.isFinite(n))
                                                updateItem(item.id, {
                                                  cantidad: n,
                                                });
                                            }}
                                            onBlur={(e) => {
                                              const n = Math.max(
                                                1,
                                                Math.trunc(
                                                  Number(e.target.value) ||
                                                    item.cantidad,
                                                ),
                                              );
                                              guardarCampoItem(item, {
                                                cantidad: n,
                                              });
                                            }}
                                            disabled={terminal || busy}
                                            className="h-8 w-12 rounded-lg border-border bg-background px-1.5 text-center text-sm shadow-xs tabular-nums"
                                          />
                                        </td>

                                        {/* Costo unitario (ARS en tooltip) */}
                                        <td className="px-2 py-2.5 align-top">
                                          <Input
                                            aria-label={`Costo unitario para ${item.textoOriginal} en ${monedaFactura}`}
                                            title={
                                              costoArs != null
                                                ? `${formatearArs(costoArs)} ARS`
                                                : undefined
                                            }
                                            type="text"
                                            inputMode="decimal"
                                            value={formatearInputMonto(
                                              item.precioUnitario,
                                            )}
                                            onChange={(e) =>
                                              updateItem(item.id, {
                                                precioUnitario: digitosAMonto(
                                                  e.target.value,
                                                ),
                                              })
                                            }
                                            onBlur={() =>
                                              guardarCampoItem(item, {
                                                precioUnitario:
                                                  item.precioUnitario,
                                              })
                                            }
                                            disabled={terminal || busy}
                                            placeholder="—"
                                            className="h-8 w-full rounded-lg border-border bg-background px-2 text-sm shadow-xs tabular-nums"
                                          />
                                        </td>

                                        {/* Precio venta */}
                                        <td className="px-2 py-2.5 align-top">
                                          {productoMatch ? (
                                            <div
                                              className="flex h-8 items-center rounded-lg border border-border bg-muted/40 px-2 text-sm font-semibold tabular-nums text-foreground"
                                              title="Precio de venta del producto existente — editalo con 'Editar producto'"
                                            >
                                              <span className="truncate">
                                                {formatMoney(
                                                  Number(
                                                    productoMatch.precioVenta,
                                                  ),
                                                )}
                                              </span>
                                            </div>
                                          ) : (
                                            <Input
                                              aria-label={`Precio de venta para ${item.textoOriginal}`}
                                              type="text"
                                              inputMode="decimal"
                                              value={formatearInputMonto(
                                                precioVentaBorrador[item.id],
                                              )}
                                              onChange={(e) =>
                                                setPrecioVentaBorrador(
                                                  (prev) => ({
                                                    ...prev,
                                                    [item.id]: digitosAMonto(
                                                      e.target.value,
                                                    ),
                                                  }),
                                                )
                                              }
                                              disabled={terminal || busy}
                                              placeholder="—"
                                              className="h-8 w-full rounded-lg border-border bg-background px-2 text-sm shadow-xs tabular-nums"
                                            />
                                          )}
                                        </td>

                                        {/* Estado: chip de confianza + badge compacto */}
                                        <td className="px-2 py-2.5 align-top">
                                          <div className="flex flex-col gap-1">
                                            <span
                                              className={cn(
                                                "inline-flex w-fit items-center rounded-full px-2 py-0.5 font-mono text-xs font-bold",
                                                confCls,
                                              )}
                                            >
                                              {conf.pct != null
                                                ? `${conf.pct}%`
                                                : "—"}
                                            </span>
                                            <span
                                              className={cn(
                                                "inline-flex items-center gap-1 text-[11px] font-semibold",
                                                badge.cls,
                                              )}
                                            >
                                              <BadgeIcon className="h-3 w-3 shrink-0" />
                                              <span className="truncate">
                                                {item.estado === "CONFIRMADO"
                                                  ? "Confirmado"
                                                  : item.estado ===
                                                      "PRODUCTO_CREADO"
                                                    ? "Creado"
                                                    : item.estado ===
                                                        "SIN_COINCIDENCIA"
                                                      ? "Sin match"
                                                      : item.estado ===
                                                          "IGNORADO"
                                                        ? "Ignorado"
                                                        : item.estado ===
                                                            "REQUIERE_REVISION"
                                                          ? "Revisar"
                                                          : "Sugerido"}
                                              </span>
                                            </span>
                                            {item.advertencias.length > 0 && (
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span className="inline-flex w-fit cursor-help items-center gap-1 text-[11px] text-[color:var(--status-warning)]">
                                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                                    Revisar
                                                  </span>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                  side="bottom"
                                                  sideOffset={4}
                                                  className="max-w-xs"
                                                >
                                                  {item.advertencias.map(
                                                    (advertencia, i) => (
                                                      <p key={i}>
                                                        {advertencia}
                                                      </p>
                                                    ),
                                                  )}
                                                </TooltipContent>
                                              </Tooltip>
                                            )}
                                          </div>
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-2 py-2.5 pr-3 align-top">
                                          {terminal ? (
                                            <span className="block text-right text-[11px] font-medium text-muted-foreground">
                                              —
                                            </span>
                                          ) : (
                                            <div
                                              role="group"
                                              aria-label={`Acciones para ${item.textoOriginal}`}
                                              className="flex items-center justify-end gap-1"
                                            >
                                              {item.productoId && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button
                                                      type="button"
                                                      size="icon-sm"
                                                      aria-label={`Confirmar coincidencia para ${item.textoOriginal}`}
                                                      className={cn(
                                                        TABLE_ACTION_ICON_CLASS,
                                                        "border-[color:var(--status-success-strong)]/35 bg-[color:var(--status-success-strong)]/14 text-[color:var(--status-success-strong)] hover:bg-[color:var(--status-success-strong)]/22",
                                                      )}
                                                      onClick={() =>
                                                        confirmarItem(item)
                                                      }
                                                      disabled={busy}
                                                    >
                                                      {busy ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                      ) : (
                                                        <Check className="h-4 w-4" />
                                                      )}
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent
                                                    side="top"
                                                    sideOffset={8}
                                                  >
                                                    Confirmar coincidencia
                                                  </TooltipContent>
                                                </Tooltip>
                                              )}

                                              {requiereAlta ? (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Button
                                                      type="button"
                                                      size="icon-sm"
                                                      variant="outline"
                                                      aria-label={`Crear producto para ${item.textoOriginal}`}
                                                      className={cn(
                                                        TABLE_ACTION_ICON_CLASS,
                                                        "border-primary/30 bg-primary/10 text-primary hover:bg-primary/18",
                                                      )}
                                                      onClick={() =>
                                                        setItemParaCrear(item)
                                                      }
                                                      disabled={busy}
                                                    >
                                                      <Plus className="h-4 w-4" />
                                                    </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent
                                                    side="top"
                                                    sideOffset={8}
                                                  >
                                                    Crear producto nuevo con
                                                    datos precargados
                                                  </TooltipContent>
                                                </Tooltip>
                                              ) : (
                                                productoMatch && (
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <EditProductoDialog
                                                        producto={productoMatch}
                                                        onUpdated={() =>
                                                          apiService
                                                            .getProductos()
                                                            .then(setProductos)
                                                            .catch(() => {})
                                                        }
                                                        open={
                                                          itemIdParaEditar ===
                                                          item.id
                                                        }
                                                        onOpenChange={(v) =>
                                                          setItemIdParaEditar(
                                                            v ? item.id : null,
                                                          )
                                                        }
                                                        trigger={
                                                          <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="outline"
                                                            aria-label={`Editar producto existente para ${item.textoOriginal}`}
                                                            className={cn(
                                                              TABLE_ACTION_ICON_CLASS,
                                                              "border-primary/30 bg-primary/10 text-primary hover:bg-primary/18",
                                                            )}
                                                            disabled={busy}
                                                          >
                                                            <PencilLine className="h-4 w-4" />
                                                          </Button>
                                                        }
                                                      />
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                      side="top"
                                                      sideOffset={8}
                                                    >
                                                      Editar el producto ya
                                                      existente que coincidió
                                                    </TooltipContent>
                                                  </Tooltip>
                                                )
                                              )}

                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Button
                                                    type="button"
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    aria-label={`Ignorar línea ${item.textoOriginal}`}
                                                    className={cn(
                                                      TABLE_ACTION_ICON_CLASS,
                                                      "border-border bg-transparent text-muted-foreground hover:border-[color:var(--status-warning)]/40 hover:bg-[color:var(--status-warning)]/10 hover:text-[color:var(--status-warning)]",
                                                    )}
                                                    onClick={() =>
                                                      ignorarItem(item)
                                                    }
                                                    disabled={busy}
                                                  >
                                                    <X className="h-4 w-4" />
                                                  </Button>
                                                </TooltipTrigger>
                                                <TooltipContent
                                                  side="top"
                                                  sideOffset={8}
                                                >
                                                  Ignorar línea
                                                </TooltipContent>
                                              </Tooltip>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
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
                  vive en el panel de resumen; el pie sólo ofrece cerrar. */}
              {!items && (
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
