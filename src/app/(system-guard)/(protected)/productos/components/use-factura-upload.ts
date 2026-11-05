// Hook de carga y análisis de la factura de proveedor.
//
// Extraído de factura-proveedor-dialog.tsx (M21) sin cambios de comportamiento:
// estado, efectos y handlers del archivo se movieron tal cual. El diálogo
// conserva el efecto de apertura/reset porque también reinicia estado de ítems,
// y usa `resetUpload` para la parte que le corresponde a este hook.

import * as React from "react";
import { toast } from "sonner";

import {
  apiService,
  type FacturaProveedor,
  type FacturaProveedorUsage,
} from "@/lib/apiService";

export type UseFacturaUploadOptions = {
  /** Se llama cuando el análisis terminó y hay factura + ítems para mostrar. */
  onFacturaCargada: (factura: FacturaProveedor) => void;
  /** Se llama cuando el análisis falló y hay que limpiar lo que hubiera. */
  onFacturaLimpiada: () => void;
};

export function useFacturaUpload({
  onFacturaCargada,
  onFacturaLimpiada,
}: UseFacturaUploadOptions) {
  const [cargandoInicial, setCargandoInicial] = React.useState(false);
  const [subiendo, setSubiendo] = React.useState(false);
  const [procesando, setProcesando] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
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

  /** Limpia sólo lo que pertenece a la carga de archivo. */
  function resetUpload() {
    setSubiendo(false);
    setProcesando(false);
    setCargandoInicial(false);
    setSelectedFile(null);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
      onFacturaCargada(procesada);
      if ((procesada.items ?? []).length === 0) {
        toast.warning(
          "No se detectaron líneas de producto en la factura. Probá con otra foto más nítida.",
        );
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al procesar la factura",
      );
      onFacturaLimpiada();
    } finally {
      setSubiendo(false);
      setProcesando(false);
    }
  }

  return {
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
  };
}
