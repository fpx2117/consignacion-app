// src/modules/invoices/config/rubros.ts
// Fuente de verdad única para los rubros de negocio: consumida por el selector
// de Setup/Ajustes, el hint de contexto del prompt de extracción de facturas
// (invoice-extraction.config.ts) y las sugerencias de clave en los editores de
// atributos de producto. Agregar un rubro nuevo es agregar una fila acá — no
// requiere migración ni tocar el prompt a mano.

export interface RubroNegocio {
  slug: string;
  label: string;
  /** Atributos típicos de este rubro, usados como hint en el prompt y como
   * sugerencias de clave en la UI. Vacío si el rubro no tiene atributos
   * específicos más allá de los campos estándar. */
  atributosTipicos: string;
}

export const RUBROS_NEGOCIO: RubroNegocio[] = [
  { slug: "kiosco", label: "Kiosco", atributosTipicos: "" },
  { slug: "almacen", label: "Almacén", atributosTipicos: "cuenta corriente / fiado de clientes" },
  { slug: "farmacia", label: "Farmacia", atributosTipicos: "lote, vencimiento, stock mínimo por medicamento" },
  { slug: "ferreteria", label: "Ferretería", atributosTipicos: "unidad de medida, marca" },
  { slug: "indumentaria", label: "Indumentaria", atributosTipicos: "talle, color" },
  { slug: "panaderia", label: "Panadería", atributosTipicos: "venta por peso, producción diaria" },
  { slug: "carniceria", label: "Carnicería", atributosTipicos: "venta por kilo, tipo de corte" },
  { slug: "verduleria", label: "Verdulería", atributosTipicos: "venta por kilo o por unidad" },
  { slug: "electronica", label: "Electrónica", atributosTipicos: "marca, modelo, IMEI/número de serie" },
  { slug: "pet_shop", label: "Pet Shop", atributosTipicos: "tipo de producto (alimento/accesorio/veterinario)" },
  { slug: "zapateria", label: "Zapatería", atributosTipicos: "número (talle de calzado), color" },
  { slug: "libreria", label: "Librería", atributosTipicos: "" },
  { slug: "gimnasio", label: "Gimnasio", atributosTipicos: "membresía vs. venta de suplementos (mixto servicio/producto)" },
  { slug: "veterinaria", label: "Veterinaria", atributosTipicos: "medicamentos, consultas registradas como ítem" },
  { slug: "peluqueria", label: "Peluquería", atributosTipicos: "servicios + productos de cabello (mixto servicio/producto)" },
  { slug: "bar_cerveceria", label: "Bar / Cervecería", atributosTipicos: "bebidas, stock por barril/botella" },
  { slug: "heladeria", label: "Heladería", atributosTipicos: "venta por kilo o unidad, sabores" },
];

export const RUBRO_OTRO_SLUG = "otro";

/** Tope de longitud para el texto libre de rubro (Setup/Ajustes), ver
 * settings/general/route.ts — evita mandar un texto largo en cada request de OCR. */
export const RUBRO_MAX_LENGTH = 60;

const RUBRO_ATRIBUTOS_TIPICOS_MAP: Record<string, string> = Object.fromEntries(
  RUBROS_NEGOCIO.map((r) => [r.slug, r.atributosTipicos]),
);

/**
 * Hint de atributos típicos para el rubro dado. Devuelve "" si el rubro no es
 * uno de los slugs fijos (texto libre de "Otro") o no tiene atributos típicos
 * definidos — en ambos casos el prompt omite la cláusula de sugerencia.
 */
export function getAtributosTipicos(rubro: string | null | undefined): string {
  if (!rubro) return "";
  return RUBRO_ATRIBUTOS_TIPICOS_MAP[rubro] ?? "";
}
