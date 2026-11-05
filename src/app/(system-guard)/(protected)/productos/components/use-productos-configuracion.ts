// Configuración de rubro y columnas de atributos de la vista de productos.
//
// Extraída de productos-view.tsx (M21) sin cambios de comportamiento: carga de la
// configuración general, estado de columnas visibles y los valores derivados que
// deciden qué columnas existen y si el nombre del producto se muestra.

import * as React from "react";
import { toast } from "sonner";

import { apiService } from "@/lib/apiService";
import { getAtributosTipicos } from "@/modules/invoices/config/rubros";
import {
  getAtributosFijos,
  getNombreCompuestoDef,
} from "@/modules/invoices/config/rubro-atributos";

import { COLUMNA_VENCIMIENTO, type ProductoViewItem } from "./productos-view-types";

export function useProductosConfiguracion({
  activeSucursalId,
  statsItems,
}: {
  activeSucursalId: number | null;
  statsItems: ProductoViewItem[];
}) {
  // Columnas dinámicas de atributosExtra (Fase 4)
  const [columnasAtributos, setColumnasAtributos] = React.useState<string[]>([]);
  const [sugerenciasRubro, setSugerenciasRubro] = React.useState<string[]>([]);
  const [rubroNegocio, setRubroNegocio] = React.useState<string | null>(null);
  // El rubro (que decide si la celda "Producto" muestra el nombre o lo
  // oculta porque se auto-compone desde columnas) se carga async. Hasta no
  // saberlo no mostramos el nombre: evita que aparezca un frame y luego lo
  // reemplacen las columnas Marca/Línea/Concentración.
  const [configCargado, setConfigCargado] = React.useState(false);

  React.useEffect(() => {
    setConfigCargado(false);
    apiService
      .getConfiguracionGeneral()
      .then(async (config) => {
        const rubro = config?.rubroNegocio ?? null;
        setRubroNegocio(rubro);
        setConfigCargado(true);
        const hint = getAtributosTipicos(rubro);
        setSugerenciasRubro(hint ? hint.split(", ").filter(Boolean) : []);

        const columnasGuardadas = [
          ...new Set(config?.columnasAtributosProducto ?? []),
        ];
        if (columnasGuardadas.length > 0) {
          setColumnasAtributos(columnasGuardadas);
          return;
        }

        // Sin columnas elegidas todavía: sembramos "vencimiento" (visible
        // por default históricamente, antes de que fuera togglable) + los
        // atributos fijos del rubro activo, si los tiene — una sola vez, no
        // pisa una elección manual porque solo corre cuando el array
        // guardado está vacío.
        const clavesFijas = getAtributosFijos(rubro).map((def) => def.clave);
        const seed = [...clavesFijas, COLUMNA_VENCIMIENTO];
        setColumnasAtributos(seed);
        try {
          await apiService.actualizarConfiguracionGeneral({
            columnasAtributosProducto: seed,
          });
        } catch {
          // No es crítico: la UI ya muestra las columnas, solo no quedó
          // persistida la preferencia hasta el próximo cambio manual.
        }
      })
      .catch(() => {
        setConfigCargado(true);
        setColumnasAtributos([]);
        setSugerenciasRubro([]);
        setRubroNegocio(null);
      });
  }, [activeSucursalId]);

  const clavesAtributosEnUso = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of statsItems) {
      if (p.atributosExtra && typeof p.atributosExtra === "object") {
        Object.keys(p.atributosExtra).forEach((k) => set.add(k));
      }
    }
    return Array.from(set);
  }, [statsItems]);

  // Las claves fijas del rubro (marca, sabor, puffs, etc.) tienen que ser
  // siempre candidatas, aunque ningún producto tenga ese dato cargado
  // todavía y aunque la clave no matchee ninguna palabra suelta del hint
  // de texto libre — si no, quedan seleccionadas por el seed automático
  // (ver Fase 4) sin ningún checkbox para poder sacarlas del picker.
  const clavesFijasDelRubro = React.useMemo(
    () => getAtributosFijos(rubroNegocio).map((def) => def.clave),
    [rubroNegocio],
  );

  // "vencimiento" no es un atributo de rubro (es Producto.fechaVencimiento,
  // un campo nativo) — se maneja aparte de columnasAtributos.map() más
  // abajo, pero comparte el mismo picker/array de columnas visibles porque
  // para el usuario es la misma decisión: "qué columna quiero ver".
  const candidatasAtributos = React.useMemo(
    () =>
      Array.from(
        new Set([
          COLUMNA_VENCIMIENTO,
          ...clavesAtributosEnUso,
          ...sugerenciasRubro,
          ...clavesFijasDelRubro,
        ]),
      ),
    [clavesAtributosEnUso, sugerenciasRubro, clavesFijasDelRubro],
  );

  // Loop genérico de columnasAtributos.map() (header/celdas) no debe
  // renderizar "vencimiento" — tiene su propia celda dedicada porque lee
  // p.fechaVencimiento, no p.atributosExtra.
  const columnasAtributosGenericos = React.useMemo(
    () => columnasAtributos.filter((c) => c !== COLUMNA_VENCIMIENTO),
    [columnasAtributos],
  );

  const labelAtributoFijo = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const def of getAtributosFijos(rubroNegocio)) {
      map.set(def.clave, def.label);
    }
    return map;
  }, [rubroNegocio]);

  // Rubros que auto-componen el nombre del producto (vapes: marca+sabor+
  // puffs; perfumes: marca+línea+concentración+ml+género; ver
  // producto-wizard-dialog.tsx) — mostrar ese texto de nuevo en la columna
  // "Producto" repite exactamente lo que ya dicen las columnas del rubro,
  // así que ahí esa celda queda solo con imagen y código de barras.
  const nombreEsAutoCompuesto = React.useMemo(
    () => !!getNombreCompuestoDef(rubroNegocio),
    [rubroNegocio],
  );
  // Mostramos el nombre en la celda "Producto" solo cuando sabemos que el
  // rubro NO lo auto-compone (y tras cargar la config). Mientras no se sabe,
  // la celda queda con imagen (+ código) para no hacer el flash "nombre que
  // aparece y luego lo reemplazan las columnas".
  const mostrarNombreProducto = configCargado && !nombreEsAutoCompuesto;

  const handleColumnasAtributosChange = async (nuevas: string[]) => {
    setColumnasAtributos(nuevas); // optimista
    try {
      await apiService.actualizarConfiguracionGeneral({
        columnasAtributosProducto: nuevas,
      });
    } catch {
      toast.error("No se pudo guardar la preferencia de columnas");
    }
  };

  return {
    columnasAtributos,
    sugerenciasRubro,
    rubroNegocio,
    configCargado,
    clavesAtributosEnUso,
    clavesFijasDelRubro,
    candidatasAtributos,
    columnasAtributosGenericos,
    labelAtributoFijo,
    nombreEsAutoCompuesto,
    mostrarNombreProducto,
    handleColumnasAtributosChange,
  };
}
