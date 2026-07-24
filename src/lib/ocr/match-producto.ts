// src/lib/ocr/match-producto.ts
// Matching aproximado de un nombre detectado por OCR contra el catálogo de productos
// existente, usando similaridad de bigramas (coeficiente de Dice). Sin dependencias externas.

export type ProductoMatch = {
  productoId: number;
  score: number;
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bigramas(texto: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < texto.length - 1; i++) {
    set.add(texto.slice(i, i + 2));
  }
  return set;
}

function coeficienteDice(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const bigA = bigramas(na);
  const bigB = bigramas(nb);
  if (bigA.size === 0 || bigB.size === 0) return 0;

  let interseccion = 0;
  for (const bg of bigA) {
    if (bigB.has(bg)) interseccion++;
  }

  return (2 * interseccion) / (bigA.size + bigB.size);
}

/**
 * Devuelve el score de todos los productos contra `nombre`, ordenado de mayor a
 * menor. Lo usa el motor de matching por capas (matching-engine.ts) para poder
 * detectar ambigüedad (dos productos con score muy parecido) y no sólo quedarse
 * con el primero.
 */
export function scoresFuzzy(
  nombre: string,
  productos: { id: number; nombre: string }[],
): ProductoMatch[] {
  return productos
    .map((producto) => ({
      productoId: producto.id,
      score: coeficienteDice(nombre, producto.nombre),
    }))
    .sort((a, b) => b.score - a.score);
}
