// src/lib/ocr/normalizar-producto.ts
// Normalización de nombres de producto para matching y para guardar como alias.
// Nunca reemplaza el texto que ve el usuario (textoOriginal en FacturaProveedorItem
// se guarda tal cual): esto sólo alimenta el motor de matching y la clave de alias.

const UNIDAD_REGEX = /(\d+(?:[.,]\d+)?)\s*(ml|mll|l|lt|g|gr|kg|cc|oz)\b/gi;

// Correcciones típicas de OCR en este dominio (perfumería). Se aplican como una
// variante alternativa del texto para mejorar el score de matching — NUNCA
// reemplazan lo que el usuario ve, y por sí solas no alcanzan para auto-confirmar
// (el umbral de coincidencia se evalúa siempre sobre el score resultante).
const CORRECCIONES_OCR: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bpim\b/g, "pink"],
  [/\blattara\b/g, "lattafa"],
  [/\bmais0n\b/g, "maison"],
  [/\bmaisan\b/g, "maison"],
  [/\bedp\b/g, "edp"],
  [/\bedt\b/g, "edt"],
];

function quitarAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Colapsa variantes de unidades: "100 ML" / "100ml" / "100  Ml" -> "100ml". */
function colapsarUnidades(texto: string): string {
  return texto.replace(
    UNIDAD_REGEX,
    (_match, cantidad: string, unidad: string) =>
      `${cantidad}${unidad.toLowerCase()}`,
  );
}

/** Normalización base: minúsculas, sin acentos, sin símbolos, espacios colapsados, unidades unificadas. */
export function normalizarTexto(texto: string): string {
  if (!texto) return "";
  const sinAcentos = quitarAcentos(texto.toLowerCase());
  const sinSimbolos = sinAcentos.replace(/[^a-z0-9\s]/g, " ");
  const espaciosColapsados = sinSimbolos.replace(/\s+/g, " ").trim();
  return colapsarUnidades(espaciosColapsados);
}

/** Aplica el diccionario de correcciones típicas de OCR sobre un texto ya normalizado. */
export function aplicarCorreccionesOcr(normalizado: string): string {
  return CORRECCIONES_OCR.reduce(
    (acc, [patron, reemplazo]) => acc.replace(patron, reemplazo),
    normalizado,
  );
}

export type ProductoNormalizado = {
  /** Normalización directa del texto original. */
  normalizado: string;
  /** Normalizado + correcciones de OCR conocidas aplicadas (para matching, no para mostrar). */
  normalizadoCorregido: string;
};

export function normalizarProducto(texto: string): ProductoNormalizado {
  const normalizado = normalizarTexto(texto);
  const normalizadoCorregido = aplicarCorreccionesOcr(normalizado);
  return { normalizado, normalizadoCorregido };
}
