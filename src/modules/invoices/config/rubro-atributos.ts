// src/modules/invoices/config/rubro-atributos.ts
//
// Catálogo de atributos FIJOS y tipados por rubro, usado en la carga manual
// de productos (/productos). Distinto de `atributosTipicos` en `rubros.ts`,
// que sigue siendo texto libre para el hint del prompt de OCR de facturas.
//
// Cobertura deliberadamente parcial: solo los rubros validados con el
// usuario (ver openspec/changes/columnas-fijas-por-rubro/tasks.md, Fase 0).
// Un rubro sin entrada acá simplemente no tiene atributos fijos — el
// wizard de producto cae al editor libre existente (`AtributosExtraEditor`),
// sin romper nada.
//
// Los valores se siguen guardando en `Producto.atributosExtra` (Json) bajo
// la `clave` definida acá, como string — `tipo` solo determina qué input se
// renderiza y cómo se valida el string antes de persistir, no cambia el
// tipo de columna en la base de datos.

export type AtributoFijoTipo = "texto" | "numero" | "seleccion" | "fecha";

export interface AtributoFijoDef {
  /** Clave bajo la que se guarda en Producto.atributosExtra. Estable: no renombrar sin migrar datos existentes. */
  clave: string;
  label: string;
  tipo: AtributoFijoTipo;
  /** Solo aplica cuando tipo === "seleccion". */
  opciones?: string[];
  requerido?: boolean;
}

export const RUBRO_ATRIBUTOS_FIJOS: Record<string, AtributoFijoDef[]> = {
  vapes: [
    { clave: "marca", label: "Marca", tipo: "texto", requerido: true },
    // No requerido: los dispositivos recargables/pods (ej. Vaporesso XROS)
    // no tienen sabor, a diferencia de los descartables.
    { clave: "sabor", label: "Sabor", tipo: "texto" },
    { clave: "puffs", label: "Puffs", tipo: "numero" },
    { clave: "nicotina_mg", label: "Nicotina (mg)", tipo: "numero" },
    {
      clave: "tipo_dispositivo",
      label: "Tipo",
      tipo: "seleccion",
      opciones: ["Descartable", "Recargable", "Pod", "Kit"],
    },
    { clave: "capacidad_ml", label: "Capacidad (ml)", tipo: "numero" },
  ],
  perfumeria: [
    { clave: "marca", label: "Marca", tipo: "texto", requerido: true },
    { clave: "linea", label: "Línea", tipo: "texto" },
    {
      clave: "concentracion",
      label: "Concentración",
      tipo: "seleccion",
      opciones: ["EDP", "EDT", "Parfum", "Body Splash", "Colonia"],
    },
    { clave: "ml", label: "ML", tipo: "numero", requerido: true },
    {
      clave: "genero",
      label: "Género",
      tipo: "seleccion",
      opciones: ["Femenino", "Masculino", "Unisex"],
    },
    { clave: "vencimiento", label: "Vencimiento", tipo: "fecha" },
  ],
  indumentaria: [
    { clave: "marca", label: "Marca", tipo: "texto" },
    { clave: "talle", label: "Talle", tipo: "texto", requerido: true },
    { clave: "color", label: "Color", tipo: "texto", requerido: true },
    {
      clave: "genero",
      label: "Género",
      tipo: "seleccion",
      opciones: ["Femenino", "Masculino", "Unisex", "Niño/a"],
    },
    {
      clave: "temporada",
      label: "Temporada",
      tipo: "seleccion",
      opciones: ["Verano", "Invierno", "Todo el año"],
    },
    { clave: "material", label: "Material", tipo: "texto" },
  ],
  zapateria: [
    { clave: "marca", label: "Marca", tipo: "texto" },
    { clave: "numero", label: "Número", tipo: "numero", requerido: true },
    { clave: "color", label: "Color", tipo: "texto", requerido: true },
    { clave: "material", label: "Material", tipo: "texto" },
    {
      clave: "genero",
      label: "Género",
      tipo: "seleccion",
      opciones: ["Femenino", "Masculino", "Unisex", "Niño/a"],
    },
    {
      clave: "tipo_calzado",
      label: "Tipo de calzado",
      tipo: "seleccion",
      opciones: ["Zapatilla", "Zapato", "Sandalia", "Bota", "Ojota"],
    },
  ],
  ferreteria: [
    { clave: "marca", label: "Marca", tipo: "texto" },
    { clave: "medida", label: "Medida", tipo: "texto", requerido: true },
    { clave: "material", label: "Material", tipo: "texto" },
    { clave: "color", label: "Color", tipo: "texto" },
    { clave: "modelo", label: "Modelo", tipo: "texto" },
    { clave: "codigo_interno", label: "Código interno", tipo: "texto" },
  ],
};

/**
 * Atributos fijos definidos para el rubro dado.
 *
 * Devuelve [] si el rubro viene vacío, es texto libre de "Otro", o no tiene
 * catálogo fijo definido — en esos casos el wizard de producto usa solo el
 * editor libre existente.
 */
export function getAtributosFijos(
  rubro: string | null | undefined,
): AtributoFijoDef[] {
  if (!rubro) return [];
  return RUBRO_ATRIBUTOS_FIJOS[rubro] ?? [];
}
